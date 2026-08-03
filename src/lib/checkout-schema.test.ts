import { describe, expect, it } from "vitest";

import { checkoutSchema } from "@/lib/validations";

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
});
