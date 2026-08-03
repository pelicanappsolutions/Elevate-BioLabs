import { describe, expect, it } from "vitest";

import {
  assertCouponConfig,
  computeCommissionCents,
  computeDiscountCents,
  normalizeCouponCode,
} from "./coupons";

describe("coupons", () => {
  it("normalizes codes", () => {
    expect(normalizeCouponCode("  partner-10 ")).toBe("PARTNER-10");
  });

  it("computes percent and fixed discounts capped at subtotal", () => {
    expect(
      computeDiscountCents({ type: "PERCENT", percentOff: 10, amountOffCents: null }, 10_000)
    ).toBe(1_000);
    expect(
      computeDiscountCents({ type: "FIXED_CENTS", percentOff: null, amountOffCents: 2_500 }, 10_000)
    ).toBe(2_500);
    expect(
      computeDiscountCents({ type: "FIXED_CENTS", percentOff: null, amountOffCents: 50_000 }, 10_000)
    ).toBe(10_000);
  });

  it("computes affiliate commission on subtotal", () => {
    expect(computeCommissionCents({ commissionPercent: 10 }, 20_000)).toBe(2_000);
    expect(computeCommissionCents({ commissionPercent: null }, 20_000)).toBe(0);
  });

  it("validates coupon config", () => {
    expect(
      assertCouponConfig({ code: "AB", type: "PERCENT", percentOff: 10 })
    ).toMatch(/at least 3/);
    expect(
      assertCouponConfig({ code: "SAVE10", type: "PERCENT", percentOff: 10 })
    ).toBeNull();
  });
});
