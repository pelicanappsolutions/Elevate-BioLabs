/**
 * Shipping rate orchestration — prefer Shippo (live/test key) when configured,
 * fall back to direct USPS (or USPS mock tiers when neither is live).
 */
import { isConfigured } from "@/lib/env";
import { getRates as getUspsRates, type ShippingRate } from "@/lib/shipping/usps";
import { getShippoRates } from "@/lib/shipping/shippo";

export type { ShippingRate };

export async function getShippingRates(input: {
  toName?: string;
  toStreet1?: string;
  toStreet2?: string;
  toCity?: string;
  toState?: string;
  toZip: string;
  weightOz: number;
}): Promise<ShippingRate[]> {
  if (isConfigured.shippo()) {
    try {
      const rates = await getShippoRates(input);
      if (rates.length > 0) return rates;
    } catch (err) {
      console.error("[shipping] Shippo rate quote failed, falling back to USPS", err);
    }
  }

  return getUspsRates({
    toZip: input.toZip,
    toState: input.toState,
    weightOz: input.weightOz,
  });
}
