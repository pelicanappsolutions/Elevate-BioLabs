/**
 * Client-safe payment rail metadata.
 *
 * Deliberately separate from ./index: that module imports every adapter, which
 * pulls in node:crypto, server env secrets, and the Prisma runtime. The checkout
 * UI only needs labels and fee copy, so it imports this file instead and keeps
 * that server-only code out of the browser bundle.
 *
 * Keys are plain string literals (not the Prisma PaymentRail enum) so nothing
 * here has a runtime dependency on @prisma/client.
 */

export type PaymentRailName =
  | "NEXAPAY"
  | "SEAMLESSCHEX"
  | "PAYRAM"
  | "STRIPE"
  | "COINBASE"
  | "P2P_ZELLE"
  | "P2P_VENMO"
  | "P2P_WIRE";

export interface PaymentRailMeta {
  label: string;
  description: string;
  feeNote: string;
  type: "card" | "ach" | "crypto" | "p2p";
  requiresProof: boolean;
}

export const PAYMENT_RAIL_META: Record<PaymentRailName, PaymentRailMeta> = {
  NEXAPAY: {
    label: "Card (NexaPay)",
    description: "Pay by credit or debit card via NexaPay.",
    feeNote: "1–3% • no rolling reserves",
    type: "card",
    requiresProof: false,
  },
  SEAMLESSCHEX: {
    label: "ACH / eCheck",
    description: "Pay directly from your bank account (verified via Plaid).",
    feeNote: "<2% • next-day funding",
    type: "ach",
    requiresProof: false,
  },
  PAYRAM: {
    label: "Card (PayRam)",
    description: "Smart-routed card payment across multiple processors for reliability.",
    feeNote: "2–4% • smart routing",
    type: "card",
    requiresProof: false,
  },
  STRIPE: {
    label: "Card (Stripe)",
    description: "Pay by credit or debit card via Stripe Checkout.",
    feeNote: "2.9% + 30¢",
    type: "card",
    requiresProof: false,
  },
  COINBASE: {
    label: "Crypto (Coinbase)",
    description: "Pay with BTC, ETH, USDC and more via Coinbase Commerce.",
    feeNote: "1% • no chargebacks",
    type: "crypto",
    requiresProof: false,
  },
  P2P_ZELLE: {
    label: "Zelle",
    description: "Send payment via Zelle using your bank app. No upload needed.",
    feeNote: "0% • manual review",
    type: "p2p",
    requiresProof: false,
  },
  P2P_VENMO: {
    label: "Venmo",
    description: "Send payment via Venmo. No upload needed.",
    feeNote: "0% • manual review",
    type: "p2p",
    requiresProof: false,
  },
  P2P_WIRE: {
    label: "Bank Wire",
    description: "Send a bank wire using the provided reference, then upload proof.",
    feeNote: "0% • manual review",
    type: "p2p",
    requiresProof: true,
  },
};
