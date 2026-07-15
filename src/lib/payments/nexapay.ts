/**
 * NexaPay adapter — high-risk-friendly hosted card processing.
 *
 * NOTE: NexaPay is stubbed to the documented API shape. The endpoints, headers
 * and webhook signature scheme below mirror the provider's public docs but have
 * NOT been exercised against a live merchant account — plug in real credentials
 * (NEXAPAY_API_KEY / NEXAPAY_SECRET / NEXAPAY_WEBHOOK_SECRET) to go live.
 *
 * Runs in MOCK mode whenever credentials are absent (isConfigured.nexapay()),
 * returning realistic fake data so checkout works locally with zero keys.
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

export const nexapayAdapter: PaymentAdapter = {
  rail: PaymentRail.NEXAPAY,

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    if (!isConfigured.nexapay()) {
      // MOCK mode — no credentials present.
      return {
        providerRef: `mock_nexa_${input.orderNumber}`,
        redirectUrl: `${input.successUrl}?mock=1`,
        mock: true,
        status: "PENDING",
      };
    }

    const res = await fetch(`${env.nexapay.baseUrl}/charges`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.nexapay.apiKey}`,
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
        metadata: { orderId: input.orderId, ...input.metadata },
      }),
    });

    if (!res.ok) {
      throw new Error(`NexaPay createCharge failed: ${res.status} ${await res.text()}`);
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

    // MOCK mode — no webhook secret configured, trust the body.
    if (!env.nexapay.webhookSecret) {
      const status = mapStatus(body.type);
      if (!status) return null;
      return {
        rail: PaymentRail.NEXAPAY,
        providerRef: body.data?.id ?? "",
        status,
        amountCents: body.data?.amount,
        feeCents: body.data?.fee,
        raw: body,
      };
    }

    const signature = input.headers.get("x-nexapay-signature") ?? "";
    const expected = crypto
      .createHmac("sha256", env.nexapay.webhookSecret)
      .update(input.rawBody)
      .digest("hex");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const status = mapStatus(body.type);
    if (!status) return null;

    return {
      rail: PaymentRail.NEXAPAY,
      providerRef: body.data?.id ?? "",
      status,
      amountCents: body.data?.amount,
      feeCents: body.data?.fee,
      raw: body,
    };
  },
};
