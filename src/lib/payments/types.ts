import type { PaymentRail } from "@prisma/client";

export type { PaymentRail };

export interface CreateChargeInput {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CreateChargeResult {
  /** Provider-side id used to reconcile the webhook. */
  providerRef: string;
  /** Where to send the customer next. For hosted checkout / crypto pages. */
  redirectUrl?: string;
  /** For inline card UIs — a client secret / token. */
  clientSecret?: string;
  /** For P2P rails — display instructions rather than a redirect. */
  instructions?: {
    method: string;
    handle: string;
    memo: string;
    note: string;
  };
  /** True when the adapter is running without real credentials. */
  mock: boolean;
  status: "PENDING" | "SUCCEEDED" | "MANUAL_REVIEW";
}

export interface WebhookVerifyInput {
  rawBody: string;
  headers: Headers;
}

export interface NormalizedWebhookEvent {
  rail: PaymentRail;
  providerRef: string;
  /** Mapped to our PaymentStatus. */
  status: "SUCCEEDED" | "FAILED" | "PENDING" | "REFUNDED";
  amountCents?: number;
  feeCents?: number;
  raw: unknown;
}

export interface PaymentAdapter {
  rail: PaymentRail;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  /**
   * Verify signature + parse. Return null when the signature is invalid so the
   * webhook route can respond 400 without touching the DB.
   */
  verifyAndParse(input: WebhookVerifyInput): Promise<NormalizedWebhookEvent | null>;
}
