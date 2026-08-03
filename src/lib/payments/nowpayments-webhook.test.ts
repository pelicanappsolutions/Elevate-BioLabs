import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({
  webhookSecret: "" as string,
}));

vi.mock("@/lib/env", () => ({
  env: {
    nowpayments: {
      get apiKey() {
        return "";
      },
      get webhookSecret() {
        return envState.webhookSecret;
      },
      get baseUrl() {
        return "https://api.nowpayments.io/v1";
      },
    },
  },
  isConfigured: {
    nowpayments: () => false,
  },
}));

import { nowpaymentsAdapter } from "@/lib/payments/nowpayments";

const BODY = JSON.stringify({
  payment_id: "np_123",
  payment_status: "finished",
  price_amount: "42.50",
});

beforeEach(() => {
  envState.webhookSecret = "";
  vi.stubEnv("NODE_ENV", "test");
});

describe("nowpaymentsAdapter.verifyAndParse", () => {
  it("rejects unsigned webhooks in production when secret is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const event = await nowpaymentsAdapter.verifyAndParse({
      rawBody: BODY,
      headers: new Headers(),
    });

    expect(event).toBeNull();
  });

  it("accepts unsigned bodies outside production for local mock", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const event = await nowpaymentsAdapter.verifyAndParse({
      rawBody: BODY,
      headers: new Headers(),
    });

    expect(event).toMatchObject({
      rail: "NOWPAYMENTS",
      providerRef: "np_123",
      status: "SUCCEEDED",
      amountCents: 4250,
    });
  });

  it("rejects bad signatures when a secret is configured", async () => {
    envState.webhookSecret = "ipn_secret";

    const event = await nowpaymentsAdapter.verifyAndParse({
      rawBody: BODY,
      headers: new Headers({ "x-nowpayments-sig": "deadbeef" }),
    });

    expect(event).toBeNull();
  });

  it("accepts a valid HMAC-SHA512 signature", async () => {
    envState.webhookSecret = "ipn_secret";
    const sig = crypto
      .createHmac("sha512", "ipn_secret")
      .update(BODY)
      .digest("hex");

    const event = await nowpaymentsAdapter.verifyAndParse({
      rawBody: BODY,
      headers: new Headers({ "x-nowpayments-sig": sig }),
    });

    expect(event?.providerRef).toBe("np_123");
    expect(event?.status).toBe("SUCCEEDED");
  });
});
