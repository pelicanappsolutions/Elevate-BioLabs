"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { assertCouponConfig, evaluateCoupon, normalizeCouponCode } from "@/lib/coupons";
import { db } from "@/lib/db";
import { priceCart } from "@/lib/pricing";
import { couponAdminSchema } from "@/lib/validations";
import type { CouponType } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session.user;
}

/** Preview a coupon against the current cart (checkout UI). */
export async function previewCoupon(input: {
  code: string;
  items: { variantId: string; quantity: number }[];
  state?: string;
  shippingCents?: number;
}): Promise<
  | {
      ok: true;
      code: string;
      discountCents: number;
      subtotalCents: number;
      shippingCents: number;
      taxCents: number;
      totalCents: number;
    }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Please sign in." };
  if (!input.items?.length) return { ok: false, error: "Your cart is empty." };

  try {
    const priced = await priceCart(input.items, {
      state: input.state,
      shippingCents: input.shippingCents ?? 0,
      couponCode: input.code,
    });
    return {
      ok: true,
      code: priced.couponCode ?? normalizeCouponCode(input.code),
      discountCents: priced.discountCents,
      subtotalCents: priced.subtotalCents,
      shippingCents: priced.shippingCents,
      taxCents: priced.taxCents,
      totalCents: priced.totalCents,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid coupon" };
  }
}

export async function upsertCoupon(
  input: unknown
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const parsed = couponAdminSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid coupon" };
  }
  const data = parsed.data;
  const code = normalizeCouponCode(data.code);
  const type = data.type as CouponType;

  const configErr = assertCouponConfig({
    code,
    type,
    percentOff: data.percentOff,
    amountOffCents:
      data.amountOffDollars != null ? Math.round(data.amountOffDollars * 100) : null,
    commissionPercent: data.commissionPercent,
    startsAt: data.startsAt ? new Date(data.startsAt) : null,
    endsAt: data.endsAt ? new Date(data.endsAt) : null,
  });
  if (configErr) return { ok: false, error: configErr };

  const payload = {
    code,
    type,
    percentOff: type === "PERCENT" ? data.percentOff ?? null : null,
    amountOffCents:
      type === "FIXED_CENTS" && data.amountOffDollars != null
        ? Math.round(data.amountOffDollars * 100)
        : null,
    active: data.active,
    startsAt: data.startsAt ? new Date(data.startsAt) : null,
    endsAt: data.endsAt ? new Date(data.endsAt) : null,
    maxRedemptions: data.maxRedemptions ?? null,
    minSubtotalCents: Math.round((data.minSubtotalDollars ?? 0) * 100),
    affiliateName: data.affiliateName?.trim() || null,
    affiliateEmail: data.affiliateEmail?.trim().toLowerCase() || null,
    affiliateNote: data.affiliateNote?.trim() || null,
    commissionPercent: data.commissionPercent ?? null,
  };

  try {
    const saved = data.id
      ? await db.coupon.update({ where: { id: data.id }, data: payload })
      : await db.coupon.create({ data: payload });

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: data.id ? "COUPON_UPDATED" : "COUPON_CREATED",
        entity: "Coupon",
        entityId: saved.id,
        meta: { code: saved.code },
      },
    });
    revalidatePath("/admin");
    return { ok: true, id: saved.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't save coupon";
    if (message.includes("Unique constraint")) {
      return { ok: false, error: "A coupon with that code already exists." };
    }
    return { ok: false, error: message };
  }
}

export async function setCouponActive(
  id: string,
  active: boolean
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };
  await db.coupon.update({ where: { id }, data: { active } });
  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: active ? "COUPON_ACTIVATED" : "COUPON_DEACTIVATED",
      entity: "Coupon",
      entityId: id,
    },
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function markRedemptionPaidOut(
  redemptionId: string,
  paidOut: boolean
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  await db.couponRedemption.update({
    where: { id: redemptionId },
    data: {
      paidOut,
      paidOutAt: paidOut ? new Date() : null,
    },
  });
  await db.auditLog.create({
    data: {
      userId: admin.id,
      action: paidOut ? "AFFILIATE_MARKED_PAID" : "AFFILIATE_MARKED_UNPAID",
      entity: "CouponRedemption",
      entityId: redemptionId,
    },
  });
  revalidatePath("/admin");
  return { ok: true };
}

/** Soft-validate without full cart pricing (tests / scripts). */
export async function validateCouponCode(code: string, subtotalCents: number) {
  return evaluateCoupon(code, subtotalCents);
}
