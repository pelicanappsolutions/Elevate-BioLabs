/**
 * P2P adapter — peer-to-peer manual rails (Zelle, Venmo, Wire).
 *
 * These rails have no API and no webhook: the customer sends funds directly
 * using the returned instructions (memo = order number), then an admin matches
 * the incoming payment and approves the order manually. createCharge therefore
 * returns display `instructions` instead of a redirect and status MANUAL_REVIEW;
 * verifyAndParse always returns null (there is no provider callback).
 */
import { PaymentRail } from "@prisma/client";
import { env } from "@/lib/env";
import type {
  PaymentAdapter,
  CreateChargeInput,
  CreateChargeResult,
} from "./types";

function instructionsFor(
  rail: PaymentRail,
  orderNumber: string
): CreateChargeResult["instructions"] {
  switch (rail) {
    case PaymentRail.P2P_VENMO:
      return {
        method: "Venmo",
        handle: env.p2p.venmo,
        memo: orderNumber,
        note: `Send the exact total to ${env.p2p.venmo} on Venmo and put "${orderNumber}" in the note. Your order ships once payment is confirmed.`,
      };
    case PaymentRail.P2P_WIRE:
      return {
        method: "Bank Wire",
        handle: env.p2p.wire,
        memo: orderNumber,
        note: `Wire the exact total using reference "${orderNumber}". ${env.p2p.wire}. Your order ships once the wire clears.`,
      };
    case PaymentRail.P2P_ZELLE:
    default:
      return {
        method: "Zelle",
        handle: env.p2p.zelle,
        memo: orderNumber,
        note: `Send the exact total to ${env.p2p.zelle} via Zelle and include "${orderNumber}" in the memo. Your order ships once payment is confirmed.`,
      };
  }
}

/** Factory — one adapter instance per P2P rail. */
export function p2pAdapterFor(rail: PaymentRail): PaymentAdapter {
  return {
    rail,

    async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
      return {
        providerRef: `p2p_${input.orderNumber}`,
        instructions: instructionsFor(rail, input.orderNumber),
        // P2P always "mock" in the sense that there is no live gateway call.
        mock: true,
        status: "MANUAL_REVIEW",
      };
    },

    // P2P is approved manually by an admin — there is never a webhook.
    async verifyAndParse() {
      return null;
    },
  };
}

/** Default P2P adapter (Zelle). */
export const p2pAdapter: PaymentAdapter = p2pAdapterFor(PaymentRail.P2P_ZELLE);
