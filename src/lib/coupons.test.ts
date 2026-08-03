import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    coupon: { findUnique: findUniqueMock },
  },
}));

import {
  assertCouponConfig,
  computeCommissionCents,
  computeDiscountCents,
  evaluateCoupon,
  normalizeCouponCode,
} from "./coupons";

function baseCoupon(overrides: Record<string, unknown> = {}) {
  return {
    id: "coup_1",
    code: "PARTNER10",
    type: "PERCENT" as const,
    percentOff: 10,
    amountOffCents: null,
    active: true,
    startsAt: null,
    endsAt: null,
    maxRedemptions: null,
    redemptionCount: 0,
    minSubtotalCents: 0,
    affiliateName: "Partner Co",
    affiliateEmail: "partner@example.com",
    affiliateNote: null,
    commissionPercent: 15,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  findUniqueMock.mockReset();
});

describe("coupons math / config", () => {
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

  it("computes affiliate commission on subtotal (not discounted total)", () => {
    expect(computeCommissionCents({ commissionPercent: 10 }, 20_000)).toBe(2_000);
    expect(computeCommissionCents({ commissionPercent: null }, 20_000)).toBe(0);
    expect(computeCommissionCents({ commissionPercent: 0 }, 20_000)).toBe(0);
  });

  it("validates coupon config", () => {
    expect(assertCouponConfig({ code: "AB", type: "PERCENT", percentOff: 10 })).toMatch(
      /at least 3/
    );
    expect(assertCouponConfig({ code: "SAVE10", type: "PERCENT", percentOff: 10 })).toBeNull();
    expect(
      assertCouponConfig({ code: "BAD!", type: "PERCENT", percentOff: 10 })
    ).toMatch(/letters, numbers/);
    expect(
      assertCouponConfig({
        code: "FIXED5",
        type: "FIXED_CENTS",
        amountOffCents: 0,
      })
    ).toMatch(/at least/);
  });
});

describe("evaluateCoupon", () => {
  it("rejects empty / unknown / inactive codes", async () => {
    expect((await evaluateCoupon("", 5000)).ok).toBe(false);
    findUniqueMock.mockResolvedValue(null);
    expect((await evaluateCoupon("NOPE", 5000)).ok).toBe(false);
    findUniqueMock.mockResolvedValue(baseCoupon({ active: false }));
    const inactive = await evaluateCoupon("PARTNER10", 5000);
    expect(inactive.ok).toBe(false);
    if (!inactive.ok) expect(inactive.error).toMatch(/not valid/i);
  });

  it("rejects outside date window and at redemption cap", async () => {
    const now = new Date("2026-08-03T12:00:00Z");
    findUniqueMock.mockResolvedValue(
      baseCoupon({ startsAt: new Date("2026-09-01T00:00:00Z") })
    );
    expect((await evaluateCoupon("PARTNER10", 5000, now)).ok).toBe(false);

    findUniqueMock.mockResolvedValue(
      baseCoupon({ endsAt: new Date("2026-07-01T00:00:00Z") })
    );
    expect((await evaluateCoupon("PARTNER10", 5000, now)).ok).toBe(false);

    findUniqueMock.mockResolvedValue(
      baseCoupon({ maxRedemptions: 5, redemptionCount: 5 })
    );
    const capped = await evaluateCoupon("PARTNER10", 5000, now);
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.error).toMatch(/redemption limit/i);
  });

  it("enforces min subtotal and returns discount + commission", async () => {
    findUniqueMock.mockResolvedValue(baseCoupon({ minSubtotalCents: 10_000 }));
    const tooSmall = await evaluateCoupon("partner10", 5_000);
    expect(tooSmall.ok).toBe(false);
    if (!tooSmall.ok) expect(tooSmall.error).toMatch(/at least \$100/);

    findUniqueMock.mockResolvedValue(baseCoupon());
    const ok = await evaluateCoupon("  partner10 ", 20_000);
    expect(ok).toEqual({
      ok: true,
      coupon: expect.objectContaining({ id: "coup_1", code: "PARTNER10" }),
      code: "PARTNER10",
      discountCents: 2_000,
      commissionCents: 3_000, // 15% of 20000
    });
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { code: "PARTNER10" } });
  });

  it("applies fixed-amount coupons", async () => {
    findUniqueMock.mockResolvedValue(
      baseCoupon({
        type: "FIXED_CENTS",
        percentOff: null,
        amountOffCents: 1_500,
        commissionPercent: null,
      })
    );
    const ok = await evaluateCoupon("PARTNER10", 10_000);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.discountCents).toBe(1_500);
      expect(ok.commissionCents).toBe(0);
    }
  });
});
