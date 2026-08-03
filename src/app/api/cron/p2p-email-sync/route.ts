import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/env";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { syncP2pEmailPayments } from "@/lib/payments/p2p-email-sync";

export const runtime = "nodejs";

/**
 * P2P payment notification sync.
 *
 * Scheduled every 15 minutes via vercel.json so Zelle/Venmo confirmations can
 * land within the "few hours" window promised at checkout (not once daily).
 * It polls the configured inbound email mailbox for Venmo/Zelle notifications,
 * parses the order number from the memo, and either auto-confirms the order
 * or queues it for manual review.
 *
 * Requires Vercel Pro (or higher) for sub-daily cron frequency — Hobby only
 * allows once-per-day schedules and will fail the deploy otherwise.
 *
 * Auth: Vercel sends Authorization: Bearer $CRON_SECRET when CRON_SECRET is set.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isConfigured.p2pEmail()) {
    return NextResponse.json({ ok: false, error: "P2P email IMAP not configured" }, { status: 503 });
  }

  try {
    const result = await syncP2pEmailPayments();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    // eslint-disable-next-line no-console
    console.error("[p2p-email-cron] failed:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
