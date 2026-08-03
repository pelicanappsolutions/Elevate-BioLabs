/**
 * Postgres-backed fixed-window rate limiter.
 *
 * The previous in-memory Map only protected a single serverless instance —
 * attackers could fan out across Vercel isolates and bypass limits. Counters
 * now live in RateLimitBucket so every instance shares the same window.
 *
 * If the DB is unreachable we allow the request (fail-open) so checkout/auth
 * are not bricked by a rate-limit table outage; the error is logged.
 */
import { db } from "@/lib/db";

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
};

export async function rateLimit(
  key: string,
  { limit = 5, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): Promise<RateLimitResult> {
  const now = new Date();
  const nextReset = new Date(now.getTime() + windowMs);

  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.rateLimitBucket.findUnique({ where: { key } });

      if (!existing || existing.resetAt <= now) {
        await tx.rateLimitBucket.upsert({
          where: { key },
          create: { key, count: 1, resetAt: nextReset },
          update: { count: 1, resetAt: nextReset },
        });
        return {
          success: true,
          remaining: Math.max(0, limit - 1),
          resetAt: nextReset.getTime(),
        };
      }

      if (existing.count >= limit) {
        return {
          success: false,
          remaining: 0,
          resetAt: existing.resetAt.getTime(),
        };
      }

      const updated = await tx.rateLimitBucket.update({
        where: { key },
        data: { count: { increment: 1 } },
      });

      return {
        success: true,
        remaining: Math.max(0, limit - updated.count),
        resetAt: existing.resetAt.getTime(),
      };
    });
  } catch (err) {
    console.error("[rate-limit] DB error — allowing request:", err);
    return {
      success: true,
      remaining: limit,
      resetAt: nextReset.getTime(),
    };
  }
}

/** Extract a client key from a request (IP-ish). */
export function clientKey(req: Request, prefix = "") {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() ?? "unknown";
  return `${prefix}:${ip}`;
}
