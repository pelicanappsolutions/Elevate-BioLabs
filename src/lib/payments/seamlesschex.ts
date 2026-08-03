/**
 * SeamlessChex adapter — ACH / eCheck processing.
 *
 * NOTE: SeamlessChex is stubbed to the documented API shape. The endpoints and
 * webhook signature scheme below mirror the provider's public docs but have NOT
 * been exercised against a live merchant account — supply real credentials
 * (SEAMLESSCHEX_API_KEY / SEAMLESSCHEX_WEBHOOK_SECRET) to go live.
 *
 * ACH transfers settle next business day, so createCharge always returns
 * PENDING; the webhook flips it to SUCCEEDED/FAILED once the bank settles.
 * Runs in MOCK mode when credentials are absent (isConfigured.seamlesschex()).
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
    case "check.paid":
    case "transaction.settled":
      return "SUCCEEDED";
    case "check.failed":
    case "transaction.failed":
      return "FAILED";
    case "check.pending":
    case "transaction.pending":
      return "PENDING";
    case "check.refunded":
    case "transaction.refunded":
      return "REFUNDED";
    default:
      return null;
  }
}

export const seamlesschexAdapter: PaymentAdapter = {
  rail: PaymentRail.SEAMLESSCHEX,

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    if (!isConfigured.seamlesschex()) {
      // MOCK mode — ACH settles next-day, so status is PENDING.
      return {
        providerRef: `mock_schex_${input.orderNumber}`,
        mock: true,
        status: "PENDING",
      };
    }

    // Bank-account ownership is verified via Plaid on the front end; the Plaid
    // processor token / account details are expected in input.metadata.
    const res = await fetch(`${env.seamlesschex.baseUrl}/check/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.seamlesschex.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: (input.amountCents / 100).toFixed(2),
        currency: input.currency,
        label: input.orderNumber,
        description: input.description,
        email: input.customerEmail,
        metadata: { orderId: input.orderId, ...input.metadata },
      }),
    });

    if (!res.ok) {
      throw new Error(
        `SeamlessChex createCharge failed: ${res.status} ${await res.text()}`
      );
    }

    const data = (await res.json()) as { id?: string; check?: { id?: string } };

    return {
      providerRef: data.id ?? data.check?.id ?? "",
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

    const secret = resolveWebhookSecret(env.seamlesschex.webhookSecret, {
      rail: "SEAMLESSCHEX",
    });
    if (secret.mode === "reject") return null;
    if (secret.mode === "verify") {
      const signature = input.headers.get("x-seamlesschex-signature") ?? "";
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
      rail: PaymentRail.SEAMLESSCHEX,
      providerRef: body.data?.id ?? "",
      status,
      amountCents: body.data?.amount,
      feeCents: body.data?.fee,
      raw: body,
    };
  },
};
