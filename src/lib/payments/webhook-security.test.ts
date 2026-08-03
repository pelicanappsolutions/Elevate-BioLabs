import { afterEach, describe, expect, it, vi } from "vitest";

import {
  allowUnsignedWebhooks,
  resolveWebhookSecret,
} from "@/lib/payments/webhook-security";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("allowUnsignedWebhooks", () => {
  it("allows unsigned bodies outside production", () => {
    expect(allowUnsignedWebhooks({ isProd: false })).toBe(true);
  });

  it("forbids unsigned bodies in production", () => {
    expect(allowUnsignedWebhooks({ isProd: true })).toBe(false);
  });
});

describe("resolveWebhookSecret", () => {
  it("returns verify mode when a secret is configured", () => {
    expect(resolveWebhookSecret("  whsec_abc  ", { isProd: true })).toEqual({
      mode: "verify",
      secret: "whsec_abc",
    });
  });

  it("allows unsigned-dev when secret missing outside production", () => {
    expect(resolveWebhookSecret("", { isProd: false })).toEqual({
      mode: "unsigned-dev",
    });
  });

  it("rejects when secret missing in production", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      resolveWebhookSecret("", { isProd: true, rail: "NOWPAYMENTS" })
    ).toEqual({ mode: "reject" });
    expect(err).toHaveBeenCalled();
  });
});
