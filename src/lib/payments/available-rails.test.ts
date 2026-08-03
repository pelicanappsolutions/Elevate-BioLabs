import { afterEach, describe, expect, it, vi } from "vitest";

const { nowpaymentsConfigured, seamlesschexConfigured } = vi.hoisted(() => ({
  nowpaymentsConfigured: vi.fn(() => false),
  seamlesschexConfigured: vi.fn(() => false),
}));

vi.mock("@/lib/env", () => ({
  isConfigured: {
    nowpayments: () => nowpaymentsConfigured(),
    seamlesschex: () => seamlesschexConfigured(),
  },
}));

import {
  getAvailableCheckoutRails,
  isCheckoutRailAllowed,
} from "@/lib/payments/available-rails";

afterEach(() => {
  vi.clearAllMocks();
  nowpaymentsConfigured.mockReturnValue(false);
  seamlesschexConfigured.mockReturnValue(false);
});

describe("getAvailableCheckoutRails", () => {
  it("always includes Zelle and Venmo", () => {
    const rails = getAvailableCheckoutRails({ isDev: false });
    expect(rails).toEqual(["P2P_ZELLE", "P2P_VENMO"]);
  });

  it("includes gateway rails in non-production even without keys (local mock)", () => {
    const rails = getAvailableCheckoutRails({ isDev: true });
    expect(rails).toEqual([
      "NOWPAYMENTS",
      "SEAMLESSCHEX",
      "P2P_ZELLE",
      "P2P_VENMO",
    ]);
  });

  it("includes only keyed gateway rails in production", () => {
    nowpaymentsConfigured.mockReturnValue(true);
    seamlesschexConfigured.mockReturnValue(false);
    const rails = getAvailableCheckoutRails({ isDev: false });
    expect(rails).toEqual(["NOWPAYMENTS", "P2P_ZELLE", "P2P_VENMO"]);
  });

  it("never includes muted card/crypto/wire rails", () => {
    nowpaymentsConfigured.mockReturnValue(true);
    seamlesschexConfigured.mockReturnValue(true);
    const rails = getAvailableCheckoutRails({ isDev: true });
    for (const muted of [
      "NEXAPAY",
      "PAYRAM",
      "STRIPE",
      "COINBASE",
      "P2P_WIRE",
    ] as const) {
      expect(rails).not.toContain(muted);
      expect(isCheckoutRailAllowed(muted, { isDev: true })).toBe(false);
    }
  });
});

describe("isCheckoutRailAllowed", () => {
  it("rejects muted rails that Zod still accepts in checkoutSchema", () => {
    expect(isCheckoutRailAllowed("NEXAPAY", { isDev: true })).toBe(false);
    expect(isCheckoutRailAllowed("P2P_ZELLE", { isDev: false })).toBe(true);
  });
});
