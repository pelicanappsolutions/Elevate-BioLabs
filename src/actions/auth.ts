"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema, resetPasswordSchema, forgotPasswordSchema } from "@/lib/validations";
import { sendTransactional } from "@/lib/email/index";
import { trackMarketing } from "@/lib/email/index";
import { passwordResetHtml } from "@/lib/email/sendgrid";
import { sendEmail } from "@/lib/email/sendgrid";

export async function registerUser(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const { name, email, password } = parsed.data;

  const rl = rateLimit(`register:${email}`, { limit: 5, windowMs: 600_000 });
  if (!rl.success) return { ok: false, error: "Too many attempts. Try again later." };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "An account with that email already exists." };

  const passwordHash = await bcrypt.hash(password, 10);

  await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      ageVerified: true,
      role: "CUSTOMER",
      verificationTier: "PENDING",
    },
  });

  // Welcome flow (SendGrid transactional + Klaviyo marketing series)
  await sendTransactional("WELCOME", { to: email, name });
  await trackMarketing("WELCOME", email);

  return { ok: true };
}

export async function requestPasswordReset(input: { email: string }): Promise<{ ok: boolean }> {
  const parsed = forgotPasswordSchema.safeParse(input);
  // Always return ok to avoid user enumeration.
  if (!parsed.success) return { ok: true };

  const rl = rateLimit(`reset-req:${parsed.data.email}`, { limit: 5, windowMs: 600_000 });
  if (!rl.success) return { ok: true };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return { ok: true };

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60); // 1h

  await db.verificationToken.create({
    data: { identifier: `pwreset:${user.email}`, token, expires },
  });

  const url = `${env.SITE_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your ElevateBioLab password",
    html: passwordResetHtml(url),
    text: `Reset your password: ${url}`,
  });

  return { ok: true };
}

export async function resetPassword(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const { token, password } = parsed.data;

  const record = await db.verificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return { ok: false, error: "This reset link is invalid or has expired." };
  }

  const email = record.identifier.replace(/^pwreset:/, "");
  const passwordHash = await bcrypt.hash(password, 10);

  await db.$transaction([
    db.user.update({ where: { email }, data: { passwordHash } }),
    db.verificationToken.delete({ where: { token } }),
  ]);

  return { ok: true };
}
