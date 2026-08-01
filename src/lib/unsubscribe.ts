/**
 * Signed one-click / link unsubscribe for marketing emails (CAN-SPAM).
 * Tokens are HMAC-SHA256 over the email using AUTH_SECRET — no DB lookup needed
 * to validate the link, then we persist opt-out via recordMarketingOptOut.
 */
import crypto from "crypto";
import { env } from "@/lib/env";
import { recordMarketingOptOut } from "@/lib/marketing";

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string): string {
  return b64url(crypto.createHmac("sha256", env.AUTH_SECRET).update(payload).digest());
}

/** Opaque token embedded in marketing email unsubscribe links. */
export function createUnsubscribeToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  const payload = b64url(normalized);
  return `${payload}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const email = fromB64url(payload).toString("utf8").trim().toLowerCase();
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

export function unsubscribeUrl(email: string): string {
  const token = createUnsubscribeToken(email);
  return `${env.SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function applyUnsubscribe(email: string): Promise<void> {
  await recordMarketingOptOut({ email });
}
