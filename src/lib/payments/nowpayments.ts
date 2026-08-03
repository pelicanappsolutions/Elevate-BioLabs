/**
 * NOWPayments adapter — crypto checkout (BTC, ETH, altcoins, stablecoins).
 *
 * Uses the NOWPayments v1 REST API (api.nowpayments.io/v1). Runs in MOCK mode
 * when credentials are absent, returning a fake hosted checkout URL so the
 * flow works locally without keys.
 *
 * Webhook path: POST /api/webhooks/payment/nowpayments
 * NOWPayments calls the configured IPN callback URL with status updates.
 *
 * Important NOWPayments quirks handled here:
 * - Invoice create returns `id` (invoice id); IPN later sends `payment_id`
 *   (different) plus `invoice_id` / `order_id` — webhook matching must use all three.
 * - IPN HMAC must be computed over alphabetically sorted JSON keys, not the raw body.
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

/** NOWPayments IPN requires deep key-sorted JSON before HMAC-SHA512. */
export function sortObject(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortObject);
  if (obj && typeof obj === "object") {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortObject((obj as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return obj;
}

export function nowpaymentsSignature(secret: string, body: unknown): string {
  return crypto
    .createHmac("sha512", secret)
    .update(JSON.stringify(sortObject(body)))
    .digest("hex");
}

function asId(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asAmountCents(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value === "string" && value.trim()) {
    const n = parseFloat(value);
    if (Number.isFinite(n)) return Math.round(n * 100);
  }
  return undefined;
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
      id?: string | number;
      payment_id?: string | number;
      invoice_url?: string;
      payment_url?: string;
      status?: string;
    };

    // Invoice endpoint returns invoice id — IPN later uses payment_id + invoice_id.
    const providerRef = asId(json.id) || asId(json.payment_id);
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

    const paymentId = asId(body.payment_id) || asId(body.id);
    const invoiceId = asId(body.invoice_id);
    const orderNumber = asId(body.order_id);
    const paymentStatus = asId(body.payment_status) || asId(body.status);

    const secret = resolveWebhookSecret(env.nowpayments.webhookSecret, {
      rail: "NOWPAYMENTS",
    });
    if (secret.mode === "reject") return null;
    if (secret.mode === "verify") {
      const signature = input.headers.get("x-nowpayments-sig") ?? "";
      const expected = nowpaymentsSignature(secret.secret, body);

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

    // Prefer payment_id for providerRef (canonical on IPN); fall back to invoice id.
    const providerRef = paymentId || invoiceId;
    if (!providerRef) return null;

    return {
      rail: PaymentRail.NOWPAYMENTS,
      providerRef,
      status,
      amountCents: asAmountCents(body.price_amount),
      orderNumber: orderNumber || undefined,
      invoiceId: invoiceId || undefined,
      raw: body,
    };
  },
};
