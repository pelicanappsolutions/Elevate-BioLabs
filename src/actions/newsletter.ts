"use server";

import { newsletterSchema } from "@/lib/validations";
import { sendEmail } from "@/lib/email/sendgrid";
import { recordMarketingOptIn } from "@/lib/marketing";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export async function subscribeNewsletter(input: {
  email: string;
  source?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const parsed = newsletterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please enter a valid email." };

  const rl = await rateLimit(`newsletter:${parsed.data.email}`, { limit: 3, windowMs: 60_000 });
  if (!rl.success) return { ok: false, error: "Too many attempts. Try again shortly." };

  const source =
    parsed.data.source === "checkout" ||
    parsed.data.source === "account" ||
    parsed.data.source === "contact"
      ? parsed.data.source
      : "newsletter";

  await recordMarketingOptIn({
    email: parsed.data.email,
    source,
  });
  return { ok: true };
}

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(5).max(4000),
});

export async function submitContact(input: {
  name: string;
  email: string;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please complete all fields." };

  const rl = await rateLimit(`contact:${parsed.data.email}`, { limit: 3, windowMs: 300_000 });
  if (!rl.success) return { ok: false, error: "Too many messages. Try again later." };

  await sendEmail({
    to: env.sendgrid.fromEmail,
    subject: `Contact form — ${parsed.data.name}`,
    html: `<p><b>From:</b> ${parsed.data.name} (${parsed.data.email})</p><p>${parsed.data.message}</p>`,
    text: `${parsed.data.name} (${parsed.data.email}): ${parsed.data.message}`,
  });
  return { ok: true };
}
