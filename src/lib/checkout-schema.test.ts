import { describe, expect, it } from "vitest";

import { checkoutSchema, couponAdminSchema } from "@/lib/validations";

const BASE = {
  email: "buyer@example.com",
  rail: "P2P_ZELLE" as const,
  shipService: "USPS_PRIORITY",
  address: {
    fullName: "Test Buyer",
    street1: "1 Main St",
    city: "New Orleans",
    state: "LA",
    zip: "70112",
    phone: "5045550100",
    country: "US",
  },
  items: [{ variantId: "cjld2cjxh0000qzrmn831i7rn", quantity: 1 }],
};

describe("checkoutSchema ageConfirm", () => {
  it("rejects checkout without RUO / age attestation", () => {
    const parsed = checkoutSchema.safeParse(BASE);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.errors.some((e) => e.path.includes("ageConfirm"))).toBe(
        true
      );
    }
  });

  it("rejects ageConfirm: false", () => {
    const parsed = checkoutSchema.safeParse({ ...BASE, ageConfirm: false });
    expect(parsed.success).toBe(false);
  });

  it("accepts ageConfirm: true with otherwise valid checkout data", () => {
    const parsed = checkoutSchema.safeParse({ ...BASE, ageConfirm: true });
    expect(parsed.success).toBe(true);
  });

  it("accepts an optional coupon code", () => {
    const parsed = checkoutSchema.safeParse({
      ...BASE,
      ageConfirm: true,
      couponCode: "PARTNER10",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.couponCode).toBe("PARTNER10");
  });
});

describe("couponAdminSchema", () => {
  it("accepts a percent affiliate coupon", () => {
    const parsed = couponAdminSchema.safeParse({
      code: "AFF10",
      type: "PERCENT",
      percentOff: 10,
      affiliateName: "Alex",
      affiliateEmail: "alex@example.com",
      commissionPercent: 15,
    });
    expect(parsed.success).toBe(true);
  });

  it("requires percent or fixed amount for the selected type", () => {
    expect(
      couponAdminSchema.safeParse({ code: "X10", type: "PERCENT" }).success
    ).toBe(false);
    expect(
      couponAdminSchema.safeParse({
        code: "X10",
        type: "FIXED_CENTS",
        amountOffDollars: 5,
      }).success
    ).toBe(true);
  });

  it("allows blank affiliate email", () => {
    const parsed = couponAdminSchema.safeParse({
      code: "PROMO5",
      type: "PERCENT",
      percentOff: 5,
      affiliateEmail: "",
    });
    expect(parsed.success).toBe(true);
  });
});
