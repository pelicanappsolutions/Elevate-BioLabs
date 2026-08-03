/**
 * PayRam adapter — smart-routing payment aggregator.
 *
 * PayRam load-balances a single charge across multiple underlying card
 * processors (round-robin / health-weighted). If one acquirer starts throttling
 * or freezing a high-risk merchant, PayRam transparently reroutes subsequent
 * transactions to another processor — this prevents the account terminations and
 * rolling reserves that plague single-processor setups in high-risk verticals.
 *
 * NOTE: PayRam is stubbed to the documented API shape. The endpoints and webhook
 * signature scheme mirror the provider's public docs but have NOT been exercised
 * against a live account — supply real credentials (PAYRAM_API_KEY /
 * PAYRAM_WEBHOOK_SECRET) to go live. Runs in MOCK mode when absent
 * (isConfigured.payram()).
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

function mapStatus(
  eventType: string
): NormalizedWebhookEvent["status"] | null {
  switch (eventType) {
    case "charge.succeeded":
      return "SUCCEEDED";
    case "charge.failed":
      return "FAILED";
    case "charge.pending":
      return "PENDING";
    case "charge.refunded":
      return "REFUNDED";
    default:
      return null;
  }
}

export const payramAdapter: PaymentAdapter = {
  rail: PaymentRail.PAYRAM,

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    if (!isConfigured.payram()) {
      // MOCK mode.
      return {
        providerRef: `mock_payram_${input.orderNumber}`,
        redirectUrl: `${input.successUrl}?mock=1`,
        mock: true,
        status: "PENDING",
      };
    }

    const res = await fetch(`${env.payram.baseUrl}/charges`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.payram.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountCents,
        currency: input.currency,
        reference: input.orderNumber,
        description: input.description,
        customer_email: input.customerEmail,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        // Let PayRam pick the healthiest processor in the pool.
        routing: "smart",
        metadata: { orderId: input.orderId, ...input.metadata },
      }),
    });

    if (!res.ok) {
      throw new Error(`PayRam createCharge failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      id: string;
      hosted_url?: string;
      redirect_url?: string;
    };

    return {
      providerRef: data.id,
      redirectUrl: data.hosted_url ?? data.redirect_url,
      mock: false,
      status: "PENDING",
    };
  },

  async verifyAndParse(
    input: WebhookVerifyInput
  ): Promise<NormalizedWebhookEvent | null> {
    const body = JSON.parse(input.rawBody) as {
      type: string;
      data?: { id?: string; amount?: number; fee?: number };
    };

    const secret = resolveWebhookSecret(env.payram.webhookSecret, {
      rail: "PAYRAM",
    });
    if (secret.mode === "reject") return null;
    if (secret.mode === "verify") {
      const signature = input.headers.get("x-payram-signature") ?? "";
      const expected = crypto
        .createHmac("sha256", secret.secret)
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

    const status = mapStatus(body.type);
    if (!status) return null;

    return {
      rail: PaymentRail.PAYRAM,
      providerRef: body.data?.id ?? "",
      status,
      amountCents: body.data?.amount,
      feeCents: body.data?.fee,
      raw: body,
    };
  },
};
