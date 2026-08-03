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

import {
  nowpaymentsAdapter,
  nowpaymentsSignature,
} from "@/lib/payments/nowpayments";

const BODY_OBJ = {
  payment_id: 123456789,
  invoice_id: 987654321,
  order_id: "EBL-7F3K9Q",
  payment_status: "finished",
  price_amount: 42.5,
};

const BODY = JSON.stringify(BODY_OBJ);

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

  it("accepts numeric payment_id / invoice_id / order_id outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const event = await nowpaymentsAdapter.verifyAndParse({
      rawBody: BODY,
      headers: new Headers(),
    });

    expect(event).toMatchObject({
      rail: "NOWPAYMENTS",
      providerRef: "123456789",
      invoiceId: "987654321",
      orderNumber: "EBL-7F3K9Q",
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

  it("accepts a valid sorted-key HMAC-SHA512 signature", async () => {
    envState.webhookSecret = "ipn_secret";
    const sig = nowpaymentsSignature("ipn_secret", BODY_OBJ);

    const event = await nowpaymentsAdapter.verifyAndParse({
      rawBody: BODY,
      headers: new Headers({ "x-nowpayments-sig": sig }),
    });

    expect(event?.providerRef).toBe("123456789");
    expect(event?.status).toBe("SUCCEEDED");
    expect(event?.orderNumber).toBe("EBL-7F3K9Q");
  });
});
