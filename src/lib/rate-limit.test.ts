import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    $transaction: vi.fn(),
    rateLimitBucket: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { rateLimit } from "@/lib/rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.$transaction.mockImplementation(async (fn: (tx: typeof dbMock) => Promise<unknown>) =>
    fn(dbMock)
  );
});

describe("rateLimit", () => {
  it("starts a new window when no bucket exists", async () => {
    dbMock.rateLimitBucket.findUnique.mockResolvedValue(null);
    dbMock.rateLimitBucket.upsert.mockResolvedValue({});

    const res = await rateLimit("checkout:a@b.com", { limit: 3, windowMs: 60_000 });

    expect(res.success).toBe(true);
    expect(res.remaining).toBe(2);
    expect(dbMock.rateLimitBucket.upsert).toHaveBeenCalled();
  });

  it("blocks when the bucket is already at the limit", async () => {
    const resetAt = new Date(Date.now() + 30_000);
    dbMock.rateLimitBucket.findUnique.mockResolvedValue({
      key: "register:a@b.com",
      count: 5,
      resetAt,
    });

    const res = await rateLimit("register:a@b.com", { limit: 5, windowMs: 600_000 });

    expect(res).toEqual({
      success: false,
      remaining: 0,
      resetAt: resetAt.getTime(),
    });
    expect(dbMock.rateLimitBucket.update).not.toHaveBeenCalled();
  });

  it("increments an existing in-window bucket", async () => {
    const resetAt = new Date(Date.now() + 30_000);
    dbMock.rateLimitBucket.findUnique.mockResolvedValue({
      key: "coa:LOT1",
      count: 2,
      resetAt,
    });
    dbMock.rateLimitBucket.update.mockResolvedValue({ count: 3, resetAt });

    const res = await rateLimit("coa:LOT1", { limit: 10, windowMs: 60_000 });

    expect(res.success).toBe(true);
    expect(res.remaining).toBe(7);
  });

  it("fails open when the database errors", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    dbMock.$transaction.mockRejectedValue(new Error("db down"));

    const res = await rateLimit("newsletter:x@y.com", { limit: 3 });

    expect(res.success).toBe(true);
    expect(err).toHaveBeenCalled();
  });
});
