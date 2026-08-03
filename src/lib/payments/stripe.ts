/**
 * Stripe adapter — hosted Checkout Sessions.
 *
 * Implemented WITHOUT the official `stripe` npm SDK: we call the REST API with
 * `fetch` and a form-urlencoded body so no extra dependency is needed. Swapping
 * to the official SDK later is trivial — replace the fetch in createCharge with
 * `stripe.checkout.sessions.create(...)` and verifyAndParse with
 * `stripe.webhooks.constructEvent(rawBody, sigHeader, secret)`.
 *
 * Runs in MOCK mode when no secret key is present (isConfigured.stripe()).
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

const STRIPE_API = "https://api.stripe.com/v1";

function mapStatus(
  eventType: string
): NormalizedWebhookEvent["status"] | null {
  switch (eventType) {
    case "checkout.session.completed":
      return "SUCCEEDED";
    case "checkout.session.async_payment_succeeded":
      return "SUCCEEDED";
    case "checkout.session.async_payment_failed":
      return "FAILED";
    case "charge.refunded":
      return "REFUNDED";
    default:
      return null;
  }
}

export const stripeAdapter: PaymentAdapter = {
  rail: PaymentRail.STRIPE,

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    if (!isConfigured.stripe()) {
      // MOCK mode.
      return {
        providerRef: `mock_cs_${input.orderNumber}`,
        redirectUrl: `${input.successUrl}?mock=1`,
        mock: true,
        status: "PENDING",
      };
    }

    // Stripe expects application/x-www-form-urlencoded with nested keys.
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", input.successUrl);
    form.set("cancel_url", input.cancelUrl);
    form.set("customer_email", input.customerEmail);
    form.set("client_reference_id", input.orderNumber);
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", input.currency.toLowerCase());
    form.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
    form.set("line_items[0][price_data][product_data][name]", input.description);
    form.set("metadata[orderId]", input.orderId);
    form.set("metadata[orderNumber]", input.orderNumber);

    const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.stripe.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!res.ok) {
      throw new Error(`Stripe createCharge failed: ${res.status} ${await res.text()}`);
    }

    const session = (await res.json()) as { id: string; url: string };

    return {
      providerRef: session.id,
      redirectUrl: session.url,
      mock: false,
      status: "PENDING",
    };
  },

  async verifyAndParse(
    input: WebhookVerifyInput
  ): Promise<NormalizedWebhookEvent | null> {
    const secret = resolveWebhookSecret(env.stripe.webhookSecret, {
      rail: "STRIPE",
    });
    if (secret.mode === "reject") return null;
    if (secret.mode === "verify") {
      const header = input.headers.get("Stripe-Signature") ?? "";
      // Header form: "t=1492774577,v1=5257a869e7...,v0=..."
      const parts = header.split(",").reduce<Record<string, string>>((acc, kv) => {
        const [k, v] = kv.split("=");
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {});

      const timestamp = parts["t"];
      const v1 = parts["v1"];
      if (!timestamp || !v1) return null;

      const signedPayload = `${timestamp}.${input.rawBody}`;
      const expected = crypto
        .createHmac("sha256", secret.secret)
        .update(signedPayload)
        .digest("hex");

      const sigBuf = Buffer.from(v1);
      const expBuf = Buffer.from(expected);
      if (
        sigBuf.length !== expBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expBuf)
      ) {
        return null;
      }
    }

    const body = JSON.parse(input.rawBody) as {
      type: string;
      data?: {
        object?: {
          id?: string;
          payment_intent?: string;
          amount_total?: number;
          amount?: number;
          client_reference_id?: string;
        };
      };
    };

    const status = mapStatus(body.type);
    if (!status) return null;

    const obj = body.data?.object ?? {};

    return {
      rail: PaymentRail.STRIPE,
      providerRef: obj.id ?? obj.payment_intent ?? "",
      status,
      amountCents: obj.amount_total ?? obj.amount,
      raw: body,
    };
  },
};
