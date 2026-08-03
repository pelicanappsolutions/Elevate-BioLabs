import { beforeEach, describe, expect, it, vi } from "vitest";

const { evaluateCouponMock, findManyMock } = vi.hoisted(() => ({
  evaluateCouponMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/coupons", () => ({
  evaluateCoupon: evaluateCouponMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    productVariant: { findMany: findManyMock },
  },
}));

import { priceCart } from "./pricing";

const VARIANT_ID = "cjld2cjxh0000qzrmn831i7rn";

beforeEach(() => {
  vi.clearAllMocks();
  findManyMock.mockResolvedValue([
    {
      id: VARIANT_ID,
      sku: "TP-10",
      strengthMg: 10,
      priceCents: 10_000,
      priceTiers: [],
      product: { id: "prod_1", name: "Test Peptide" },
    },
  ]);
});

describe("priceCart + coupons", () => {
  it("prices without a coupon and leaves discount at 0", async () => {
    const priced = await priceCart([{ variantId: VARIANT_ID, quantity: 1 }], {
      state: "TX",
      shippingCents: 995,
    });
    expect(evaluateCouponMock).not.toHaveBeenCalled();
    expect(priced.discountCents).toBe(0);
    expect(priced.taxCents).toBe(Math.round(10_000 * 0.0825));
    expect(priced.totalCents).toBe(10_000 + 995 + priced.taxCents);
  });

  it("applies coupon discount before tax", async () => {
    evaluateCouponMock.mockResolvedValue({
      ok: true,
      coupon: { id: "coup_1" },
      code: "SAVE10",
      discountCents: 1_000,
      commissionCents: 500,
    });

    const priced = await priceCart([{ variantId: VARIANT_ID, quantity: 1 }], {
      state: "TX",
      shippingCents: 995,
      couponCode: "save10",
    });

    expect(evaluateCouponMock).toHaveBeenCalledWith("save10", 10_000);
    expect(priced.discountCents).toBe(1_000);
    expect(priced.couponCode).toBe("SAVE10");
    expect(priced.couponId).toBe("coup_1");
    expect(priced.commissionCents).toBe(500);
    // Tax on (10000 - 1000), not full subtotal
    expect(priced.taxCents).toBe(Math.round(9_000 * 0.0825));
    expect(priced.totalCents).toBe(9_000 + 995 + priced.taxCents);
  });

  it("surfaces invalid coupon errors to checkout", async () => {
    evaluateCouponMock.mockResolvedValue({
      ok: false,
      error: "That coupon code is not valid.",
    });
    await expect(
      priceCart([{ variantId: VARIANT_ID, quantity: 1 }], { couponCode: "BAD" })
    ).rejects.toThrow(/not valid/i);
  });

  it("ignores blank coupon codes", async () => {
    const priced = await priceCart([{ variantId: VARIANT_ID, quantity: 1 }], {
      couponCode: "   ",
    });
    expect(evaluateCouponMock).not.toHaveBeenCalled();
    expect(priced.discountCents).toBe(0);
  });

  it("charges Louisiana sales tax at 10.25% on taxable merchandise", async () => {
    const priced = await priceCart([{ variantId: VARIANT_ID, quantity: 1 }], {
      state: "LA",
      shippingCents: 995,
    });
    expect(priced.taxCents).toBe(1_025);
    expect(priced.totalCents).toBe(10_000 + 995 + 1_025);
  });
});
