/**
 * NOWPayments adapter — crypto checkout (BTC, ETH, altcoins, stablecoins).
 *
 * Uses the NOWPayments v1 REST API (api.nowpayments.io/v1). Runs in MOCK mode
 * when credentials are absent, returning a fake hosted checkout URL so the
 * flow works locally without keys.
 *
 * Webhook path: POST /api/webhooks/payment/nowpayments
 * NOWPayments calls the configured IPN callback URL with status updates.
 */
import crypto from "crypto";
import { PaymentRail } from "@prisma/client";
import { env, isConfigured } from "@/lib/env";
import type {
  PaymentAdapter,
  CreateChargeInput,
  CreateChargeResult,
  WebhookVerifyInput,
  NormalizedWebhookEvent,
} from "./types";
import { resolveWebhookSecret } from "./webhook-security";

const NOWPAYMENTS_API = env.nowpayments.baseUrl || "https://api.nowpayments.io/v1";

function mapStatus(
  paymentStatus: string
): NormalizedWebhookEvent["status"] | null {
  switch (paymentStatus.toLowerCase()) {
    case "waiting":
    case "confirming":
    case "sending":
    case "partially_paid":
      return "PENDING";
    case "confirmed":
    case "finished":
      return "SUCCEEDED";
    case "failed":
    case "expired":
      return "FAILED";
    case "refunded":
      return "REFUNDED";
    default:
      return null;
  }
}

export const nowpaymentsAdapter: PaymentAdapter = {
  rail: PaymentRail.NOWPAYMENTS,

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    if (!isConfigured.nowpayments()) {
      // MOCK mode — no real API call, keep the checkout flow testable.
      return {
        providerRef: `mock_np_${input.orderNumber}`,
        redirectUrl: `${input.successUrl}?mock=1`,
        mock: true,
        status: "PENDING",
      };
    }

    const res = await fetch(`${NOWPAYMENTS_API}/invoice`, {
      method: "POST",
      headers: {
        "x-api-key": env.nowpayments.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: (input.amountCents / 100).toFixed(2),
        price_currency: input.currency || "usd",
        order_id: input.orderNumber,
        order_description: input.description,
        ipn_callback_url: `${env.SITE_URL}/api/webhooks/payment/nowpayments`,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      }),
    });

    const rawBody = await res.text();
    if (!res.ok) {
      throw new Error(
        `NOWPayments createCharge failed: ${res.status} ${rawBody}`
      );
    }

    const json = JSON.parse(rawBody) as {
      id?: string;
      payment_id?: string;
      invoice_url?: string;
      payment_url?: string;
      status?: string;
    };

    const providerRef = json.id || json.payment_id;
    if (!providerRef) {
      throw new Error("NOWPayments response missing id/payment_id");
    }

    return {
      providerRef,
      redirectUrl: json.invoice_url || json.payment_url || input.successUrl,
      mock: false,
      status: "PENDING",
    };
  },

  async verifyAndParse(
    input: WebhookVerifyInput
  ): Promise<NormalizedWebhookEvent | null> {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(input.rawBody);
    } catch {
      return null;
    }

    const paymentId =
      (typeof body.payment_id === "string" && body.payment_id) ||
      (typeof body.id === "string" && body.id) ||
      "";
    const paymentStatus =
      (typeof body.payment_status === "string" && body.payment_status) ||
      (typeof body.status === "string" && body.status) ||
      "";
    const priceAmount =
      typeof body.price_amount === "string" ? body.price_amount : undefined;

    const secret = resolveWebhookSecret(env.nowpayments.webhookSecret, {
      rail: "NOWPAYMENTS",
    });
    if (secret.mode === "reject") return null;
    if (secret.mode === "verify") {
      const signature = input.headers.get("x-nowpayments-sig") ?? "";
      const expected = crypto
        .createHmac("sha512", secret.secret)
        .update(input.rawBody)
        .digest("hex");

      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (
        sigBuf.length !== expBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expBuf)
      ) {
        return null;
      }
    }

    const status = mapStatus(paymentStatus);
    if (!status) return null;

    return {
      rail: PaymentRail.NOWPAYMENTS,
      providerRef: paymentId,
      status,
      amountCents: priceAmount
        ? Math.round(parseFloat(priceAmount) * 100)
        : undefined,
      raw: body,
    };
  },
};
