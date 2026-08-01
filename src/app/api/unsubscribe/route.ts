/**
 * One-click List-Unsubscribe (RFC 8058) endpoint used by Gmail/Yahoo.
 * POST body: List-Unsubscribe=One-Click  with token in query string.
 */
import { NextResponse } from "next/server";
import { applyUnsubscribe, verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  const email = token ? verifyUnsubscribeToken(token) : null;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 400 });
  }
  await applyUnsubscribe(email);
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  // Some clients probe with GET — still honor it.
  return handle(req);
}
