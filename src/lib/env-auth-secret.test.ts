import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveAuthSecret } from "@/lib/env";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveAuthSecret", () => {
  it("returns a configured secret", () => {
    expect(
      resolveAuthSecret({
        authSecret: "  real-secret  ",
        nodeEnv: "production",
        vercelEnv: "production",
      })
    ).toBe("real-secret");
  });

  it("throws in production when secret is missing", () => {
    expect(() =>
      resolveAuthSecret({
        authSecret: "",
        nextAuthSecret: "",
        nodeEnv: "production",
      })
    ).toThrow(/required in production/i);
  });

  it("throws in production when secret is the insecure default", () => {
    expect(() =>
      resolveAuthSecret({
        authSecret: "dev-secret",
        nodeEnv: "production",
      })
    ).toThrow(/must not be the insecure default/i);
  });

  it("throws when VERCEL_ENV is production even if NODE_ENV is not", () => {
    expect(() =>
      resolveAuthSecret({
        authSecret: "",
        nodeEnv: "development",
        vercelEnv: "production",
      })
    ).toThrow(/required in production/i);
  });

  it("falls back to dev-secret outside production with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      resolveAuthSecret({
        authSecret: "",
        nodeEnv: "development",
        vercelEnv: undefined,
      })
    ).toBe("dev-secret");
    expect(warn).toHaveBeenCalled();
  });

  it("prefers AUTH_SECRET over NEXTAUTH_SECRET", () => {
    expect(
      resolveAuthSecret({
        authSecret: "from-auth",
        nextAuthSecret: "from-nextauth",
        nodeEnv: "test",
      })
    ).toBe("from-auth");
  });
});
