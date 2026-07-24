"use server";

import { headers } from "next/headers";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Records an 18+ / RUO age-gate confirmation to the audit log with the client
 * IP and a server timestamp (AuditLog.createdAt). Guest-safe — the gate is
 * shown to logged-out visitors — so it never requires a session; a userId is
 * attached only when one is present.
 *
 * Fire-and-forget from the UI: a logging failure must never block a visitor
 * from entering the site.
 */
export async function logAgeConfirmation(): Promise<{ ok: boolean }> {
  const h = headers();
  // Behind a proxy (Vercel), the real client IP is the first x-forwarded-for
  // entry; fall back to x-real-ip, else unknown (e.g. local dev).
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown";
  const userAgent = h.get("user-agent") ?? undefined;

  // Light abuse guard so the endpoint can't be hammered to flood the log.
  const rl = rateLimit(`age-confirm:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!rl.success) return { ok: false };

  const session = await auth().catch(() => null);

  await db.auditLog.create({
    data: {
      userId: session?.user?.id ?? null,
      action: "AGE_CONFIRMED",
      entity: "AgeGate",
      ip,
      meta: {
        minAge: 18,
        attestation: "Confirmed 18+ and RUO acknowledgement",
        userAgent,
        confirmedAt: new Date().toISOString(),
      },
    },
  });

  return { ok: true };
}
