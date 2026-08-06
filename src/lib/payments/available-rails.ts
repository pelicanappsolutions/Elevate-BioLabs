/**
 * Single source of truth for which payment rails customers may use at checkout.
 *
 * The checkout page and placeOrder must stay in lockstep — UI-only filtering
 * left the server accepting muted/unconfigured rails that fall into MOCK
 * charges after inventory was already decremented.
 *
 * Launch policy:
 *   - Crypto (NOWPayments) when keyed (or always in non-production for local mock)
 *   - ACH (SeamlessChex) when keyed (or always in non-production)
 *   - Zelle + Venmo (manual P2P) always
 * Card / Coinbase / Wire stay in the codebase but are not offered until re-enabled here.
 */
import type { PaymentRail } from "@prisma/client";
import { isConfigured } from "@/lib/env";

/** Rails currently allowed for customer checkout. */
export function getAvailableCheckoutRails(
  opts: { isDev?: boolean } = {}
): PaymentRail[] {
  const isDev = opts.isDev ?? process.env.NODE_ENV !== "production";
  const configured: PaymentRail[] = [];

  if (isConfigured.nowpayments() || isDev) configured.push("NOWPAYMENTS");
  // ACH (SeamlessChex) disabled until a new high-risk ACH provider is onboarded.
  // if (isConfigured.seamlesschex() || isDev) configured.push("SEAMLESSCHEX");

  return [...configured, "P2P_ZELLE", "P2P_VENMO"];
}

/** True when `rail` is in the live checkout allowlist. */
export function isCheckoutRailAllowed(
  rail: PaymentRail,
  opts: { isDev?: boolean } = {}
): boolean {
  return getAvailableCheckoutRails(opts).includes(rail);
}
