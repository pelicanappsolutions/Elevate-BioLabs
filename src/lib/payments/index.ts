/**
 * Payment router — single entry point the rest of the app uses.
 *
 * Maps a PaymentRail enum to its adapter, exposes thin createCharge/verifyWebhook
 * convenience wrappers, resolves a webhook URL segment to a rail, and provides
 * UI metadata for each rail. All adapters run in MOCK mode with no credentials.
 */
import { PaymentRail } from "@prisma/client";
import type {
  PaymentAdapter,
  CreateChargeInput,
  CreateChargeResult,
  WebhookVerifyInput,
  NormalizedWebhookEvent,
} from "./types";
import { nexapayAdapter } from "./nexapay";
import { seamlesschexAdapter } from "./seamlesschex";
import { coinbaseAdapter } from "./coinbase";
import { payramAdapter } from "./payram";
import { stripeAdapter } from "./stripe";
import { nowpaymentsAdapter } from "./nowpayments";
import { p2pAdapter, p2pAdapterFor } from "./p2p";

export function getAdapter(rail: PaymentRail): PaymentAdapter {
  switch (rail) {
    case PaymentRail.NEXAPAY:
      return nexapayAdapter;
    case PaymentRail.SEAMLESSCHEX:
      return seamlesschexAdapter;
    case PaymentRail.PAYRAM:
      return payramAdapter;
    case PaymentRail.STRIPE:
      return stripeAdapter;
    case PaymentRail.COINBASE:
      return coinbaseAdapter;
    case PaymentRail.NOWPAYMENTS:
      return nowpaymentsAdapter;
    case PaymentRail.P2P_ZELLE:
    case PaymentRail.P2P_VENMO:
    case PaymentRail.P2P_WIRE:
      return p2pAdapterFor(rail);
    default: {
      // Exhaustiveness guard.
      const _never: never = rail;
      return _never;
    }
  }
}

export function createCharge(
  rail: PaymentRail,
  input: CreateChargeInput
): Promise<CreateChargeResult> {
  return getAdapter(rail).createCharge(input);
}

export function verifyWebhook(
  rail: PaymentRail,
  input: WebhookVerifyInput
): Promise<NormalizedWebhookEvent | null> {
  return getAdapter(rail).verifyAndParse(input);
}

/** Map a webhook URL segment (e.g. /api/webhooks/nexapay) to a rail. */
export function railFromWebhookPath(pathSegment: string): PaymentRail | null {
  switch (pathSegment.toLowerCase()) {
    case "nexapay":
      return PaymentRail.NEXAPAY;
    case "seamlesschex":
      return PaymentRail.SEAMLESSCHEX;
    case "payram":
      return PaymentRail.PAYRAM;
    case "stripe":
      return PaymentRail.STRIPE;
    case "coinbase":
      return PaymentRail.COINBASE;
    case "nowpayments":
      return PaymentRail.NOWPAYMENTS;
    default:
      return null;
  }
}

/**
 * Rail display metadata lives in ./meta so client components can import it
 * without pulling every adapter (and node:crypto / server env) into the bundle.
 * Re-exported here so server-side callers have a single import surface.
 */
export { PAYMENT_RAIL_META } from "./meta";
export type { PaymentRailMeta, PaymentRailName } from "./meta";
export {
  getAvailableCheckoutRails,
  isCheckoutRailAllowed,
} from "./available-rails";

export { p2pAdapter, p2pAdapterFor };
export type {
  PaymentAdapter,
  CreateChargeInput,
  CreateChargeResult,
  WebhookVerifyInput,
  NormalizedWebhookEvent,
};
