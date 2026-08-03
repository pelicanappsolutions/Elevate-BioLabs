/**
 * Authorize cron endpoints.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when the project has
 * a CRON_SECRET env var. We previously checked AUTH_SECRET only, so production
 * cron invocations 401'd silently.
 *
 * Also accepts an explicitly configured AUTH_SECRET / NEXTAUTH_SECRET for
 * manual ops curls. The hardcoded "dev-secret" fallback is only valid outside
 * production.
 */
import crypto from "crypto";

import { env } from "@/lib/env";

function bearerMatches(header: string, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function isAuthorizedCronRequest(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  if (!header) return false;

  const cronSecret = env.CRON_SECRET.trim();
  if (cronSecret && bearerMatches(header, cronSecret)) return true;

  const explicitAuth = (
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    ""
  ).trim();
  if (explicitAuth && bearerMatches(header, explicitAuth)) return true;

  if (
    process.env.NODE_ENV !== "production" &&
    env.AUTH_SECRET &&
    bearerMatches(header, env.AUTH_SECRET)
  ) {
    return true;
  }

  return false;
}
