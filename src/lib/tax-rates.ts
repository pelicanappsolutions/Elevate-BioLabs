/**
 * Destination-based sales-tax rates used by server pricing and checkout UI estimates.
 *
 * Louisiana: soft-launch flat combined rate (state 5% + typical local). Exact
 * parish/city rates vary by ship-to address — refine with LDR Sales Tax Explorer
 * / TaxJar when volume warrants. Belle Chasse / Plaquemines general rate is
 * currently ~10.25% (as of July 2026).
 */
export const TAX_RATES: Record<string, number> = {
  LA: 0.1025,
  TX: 0.0825,
  CA: 0.0725,
  NY: 0.08,
  FL: 0.06,
};

/** Combined sales-tax rate for a US state code, or 0 if unknown / untaxed. */
export function salesTaxRateForState(state?: string | null): number {
  if (!state) return 0;
  return TAX_RATES[state.trim().toUpperCase()] ?? 0;
}

/** Tax cents on taxable merchandise (after discount; shipping not taxed here). */
export function salesTaxCents(taxableCents: number, state?: string | null): number {
  if (taxableCents <= 0) return 0;
  return Math.round(taxableCents * salesTaxRateForState(state));
}
