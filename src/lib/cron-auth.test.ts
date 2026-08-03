import { afterEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({
  CRON_SECRET: "",
  AUTH_SECRET: "dev-secret",
}));

vi.mock("@/lib/env", () => ({
  env: {
    get CRON_SECRET() {
      return envState.CRON_SECRET;
    },
    get AUTH_SECRET() {
      return envState.AUTH_SECRET;
    },
  },
}));

import { isAuthorizedCronRequest } from "@/lib/cron-auth";

afterEach(() => {
  envState.CRON_SECRET = "";
  envState.AUTH_SECRET = "dev-secret";
  delete process.env.AUTH_SECRET;
  delete process.env.NEXTAUTH_SECRET;
  vi.unstubAllEnvs();
});

describe("isAuthorizedCronRequest", () => {
  it("accepts Vercel CRON_SECRET bearer tokens", () => {
    envState.CRON_SECRET = "vercel-cron-secret";
    vi.stubEnv("NODE_ENV", "production");

    const ok = isAuthorizedCronRequest(
      new Request("https://example.com/api/cron/sync-tracking", {
        headers: { authorization: "Bearer vercel-cron-secret" },
      })
    );
    expect(ok).toBe(true);
  });

  it("rejects production requests that only present the AUTH_SECRET default", () => {
    envState.CRON_SECRET = "vercel-cron-secret";
    envState.AUTH_SECRET = "dev-secret";
    vi.stubEnv("NODE_ENV", "production");

    const ok = isAuthorizedCronRequest(
      new Request("https://example.com/api/cron/sync-tracking", {
        headers: { authorization: "Bearer dev-secret" },
      })
    );
    expect(ok).toBe(false);
  });

  it("accepts an explicitly configured AUTH_SECRET for manual ops", () => {
    process.env.AUTH_SECRET = "real-auth-secret";
    envState.AUTH_SECRET = "real-auth-secret";
    vi.stubEnv("NODE_ENV", "production");

    const ok = isAuthorizedCronRequest(
      new Request("https://example.com/api/cron/p2p-email-sync", {
        headers: { authorization: "Bearer real-auth-secret" },
      })
    );
    expect(ok).toBe(true);
  });

  it("rejects missing Authorization header", () => {
    envState.CRON_SECRET = "vercel-cron-secret";
    vi.stubEnv("NODE_ENV", "production");

    expect(
      isAuthorizedCronRequest(
        new Request("https://example.com/api/cron/sync-tracking")
      )
    ).toBe(false);
  });

  it("allows AUTH_SECRET fallback outside production for local curls", () => {
    envState.AUTH_SECRET = "dev-secret";
    vi.stubEnv("NODE_ENV", "development");

    expect(
      isAuthorizedCronRequest(
        new Request("http://localhost:3000/api/cron/sync-tracking", {
          headers: { authorization: "Bearer dev-secret" },
        })
      )
    ).toBe(true);
  });
});
