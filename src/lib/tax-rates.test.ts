import { describe, expect, it } from "vitest";

import { salesTaxCents, salesTaxRateForState } from "./tax-rates";

describe("tax-rates", () => {
  it("applies Louisiana combined soft-launch rate (10.25%)", () => {
    expect(salesTaxRateForState("LA")).toBe(0.1025);
    expect(salesTaxRateForState("la")).toBe(0.1025);
    expect(salesTaxCents(10_000, "LA")).toBe(1_025);
  });

  it("keeps existing state rates", () => {
    expect(salesTaxCents(10_000, "TX")).toBe(825);
    expect(salesTaxCents(10_000, "FL")).toBe(600);
  });

  it("returns 0 for unknown or missing states", () => {
    expect(salesTaxCents(10_000, "WA")).toBe(0);
    expect(salesTaxCents(10_000, null)).toBe(0);
    expect(salesTaxCents(0, "LA")).toBe(0);
  });
});
