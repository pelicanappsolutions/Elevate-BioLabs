/**
 * Persist marketing opt-in locally (MarketingSubscriber + User.marketingOptIn)
 * and optionally sync to Klaviyo. Used by checkout, newsletter, and account prefs.
 */
import { db } from "@/lib/db";
import { subscribeNewsletter } from "@/lib/email/index";

export async function recordMarketingOptIn(input: {
  email: string;
  source: "checkout" | "newsletter" | "account" | "contact";
  name?: string | null;
  phone?: string | null;
  userId?: string | null;
  syncKlaviyo?: boolean;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return;

  let userId = input.userId ?? null;
  if (!userId) {
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    userId = existing?.id ?? null;
  }

  await db.marketingSubscriber.upsert({
    where: { email },
    create: {
      email,
      name: input.name?.trim() || null,
      phone: input.phone?.trim() || null,
      source: input.source,
      userId,
      active: true,
      optedInAt: new Date(),
    },
    update: {
      name: input.name?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      source: input.source,
      userId: userId ?? undefined,
      active: true,
      optedInAt: new Date(),
    },
  });

  if (userId) {
    await db.user.update({
      where: { id: userId },
      data: { marketingOptIn: true },
    });
  }

  if (input.syncKlaviyo !== false) {
    await subscribeNewsletter(email, input.source).catch(() => {});
  }
}

export async function recordMarketingOptOut(input: {
  email: string;
  userId?: string | null;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  await db.marketingSubscriber.updateMany({
    where: { email },
    data: { active: false },
  });
  // Clear account flag too — unsubscribe links only know the email.
  await db.user.updateMany({
    where: input.userId ? { id: input.userId } : { email },
    data: { marketingOptIn: false },
  });
}

/** Distinct active marketing emails for promotional blasts. */
export async function listMarketingEmails(limit = 5000): Promise<string[]> {
  const [users, subscribers] = await Promise.all([
    db.user.findMany({
      where: { role: "CUSTOMER", marketingOptIn: true },
      select: { email: true },
      take: limit,
    }),
    db.marketingSubscriber.findMany({
      where: { active: true },
      select: { email: true },
      take: limit,
    }),
  ]);

  const set = new Set<string>();
  for (const u of users) set.add(u.email.toLowerCase());
  for (const s of subscribers) set.add(s.email.toLowerCase());
  return [...set].slice(0, limit);
}
