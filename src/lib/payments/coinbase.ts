/**
 * Coinbase Commerce adapter — crypto checkout (BTC, ETH, USDC, …).
 *
 * Uses the real Coinbase Commerce REST API shape (api.commerce.coinbase.com).
 * Runs in MOCK mode when credentials are absent (isConfigured.coinbase()),
 * returning a fake hosted checkout URL so the flow works locally.
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

const COINBASE_API = "https://api.commerce.coinbase.com";

function mapStatus(
  eventType: string
): NormalizedWebhookEvent["status"] | null {
  switch (eventType) {
    case "charge:confirmed":
      return "SUCCEEDED";
    case "charge:failed":
      return "FAILED";
    case "charge:pending":
      return "PENDING";
    case "charge:resolved":
      return "SUCCEEDED";
    default:
      return null;
  }
}

export const coinbaseAdapter: PaymentAdapter = {
  rail: PaymentRail.COINBASE,

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    if (!isConfigured.coinbase()) {
      // MOCK mode.
      return {
        providerRef: `mock_cb_${input.orderNumber}`,
        redirectUrl: `${input.successUrl}?mock=1`,
        mock: true,
        status: "PENDING",
      };
    }

    const res = await fetch(`${COINBASE_API}/charges`, {
      method: "POST",
      headers: {
        "X-CC-Api-Key": env.coinbase.apiKey,
        "X-CC-Version": "2018-03-22",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: input.description,
        description: `Order ${input.orderNumber}`,
        pricing_type: "fixed_price",
        local_price: {
          amount: (input.amountCents / 100).toFixed(2),
          currency: input.currency,
        },
        redirect_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
      }),
    });

    if (!res.ok) {
      throw new Error(`Coinbase createCharge failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as {
      data: { id: string; code: string; hosted_url: string };
    };

    return {
      providerRef: json.data.code,
      redirectUrl: json.data.hosted_url,
      mock: false,
      status: "PENDING",
    };
  },

  async verifyAndParse(
    input: WebhookVerifyInput
  ): Promise<NormalizedWebhookEvent | null> {
    const body = JSON.parse(input.rawBody) as {
      event?: {
        type: string;
        data?: {
          code?: string;
          pricing?: { local?: { amount?: string } };
        };
      };
    };

    // MOCK mode — no webhook secret, trust the body.
    if (env.coinbase.webhookSecret) {
      const signature = input.headers.get("X-CC-Webhook-Signature") ?? "";
      const expected = crypto
        .createHmac("sha256", env.coinbase.webhookSecret)
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

    const type = body.event?.type ?? "";
    const status = mapStatus(type);
    if (!status) return null;

    const amountStr = body.event?.data?.pricing?.local?.amount;

    return {
      rail: PaymentRail.COINBASE,
      providerRef: body.event?.data?.code ?? "",
      status,
      amountCents: amountStr ? Math.round(parseFloat(amountStr) * 100) : undefined,
      raw: body,
    };
  },
};
