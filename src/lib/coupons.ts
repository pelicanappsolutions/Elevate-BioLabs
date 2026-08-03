import type { Coupon, CouponType } from "@prisma/client";

import { db } from "@/lib/db";

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export type CouponEvalOk = {
  ok: true;
  coupon: Coupon;
  code: string;
  discountCents: number;
  commissionCents: number;
};

export type CouponEvalErr = { ok: false; error: string };

/**
 * Pure discount math against merchandise subtotal (before shipping/tax).
 * Cap at subtotal so totals never go negative.
 */
export function computeDiscountCents(
  coupon: Pick<Coupon, "type" | "percentOff" | "amountOffCents">,
  subtotalCents: number
): number {
  if (subtotalCents <= 0) return 0;
  let discount = 0;
  if (coupon.type === "PERCENT") {
    const pct = Math.min(100, Math.max(0, coupon.percentOff ?? 0));
    discount = Math.round((subtotalCents * pct) / 100);
  } else {
    discount = Math.max(0, coupon.amountOffCents ?? 0);
  }
  return Math.min(discount, subtotalCents);
}

export function computeCommissionCents(
  coupon: Pick<Coupon, "commissionPercent">,
  subtotalCents: number
): number {
  const pct = coupon.commissionPercent;
  if (pct == null || pct <= 0 || subtotalCents <= 0) return 0;
  return Math.round((subtotalCents * Math.min(100, pct)) / 100);
}

function windowOk(coupon: Coupon, now: Date): boolean {
  if (coupon.startsAt && now < coupon.startsAt) return false;
  if (coupon.endsAt && now > coupon.endsAt) return false;
  return true;
}

/** Load + validate a code for the given merchandise subtotal. */
export async function evaluateCoupon(
  rawCode: string | undefined | null,
  subtotalCents: number,
  now = new Date()
): Promise<CouponEvalOk | CouponEvalErr> {
  const code = normalizeCouponCode(rawCode ?? "");
  if (!code) return { ok: false, error: "Enter a coupon code." };

  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) {
    return { ok: false, error: "That coupon code is not valid." };
  }
  if (!windowOk(coupon, now)) {
    return { ok: false, error: "That coupon is not active right now." };
  }
  if (coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions) {
    return { ok: false, error: "That coupon has reached its redemption limit." };
  }
  if (subtotalCents < coupon.minSubtotalCents) {
    return {
      ok: false,
      error: `This coupon requires a subtotal of at least $${(coupon.minSubtotalCents / 100).toFixed(2)}.`,
    };
  }

  const discountCents = computeDiscountCents(coupon, subtotalCents);
  if (discountCents <= 0) {
    return { ok: false, error: "That coupon does not apply to this order." };
  }

  return {
    ok: true,
    coupon,
    code,
    discountCents,
    commissionCents: computeCommissionCents(coupon, subtotalCents),
  };
}

export type CouponInput = {
  code: string;
  type: CouponType;
  percentOff?: number | null;
  amountOffCents?: number | null;
  active?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  maxRedemptions?: number | null;
  minSubtotalCents?: number;
  affiliateName?: string | null;
  affiliateEmail?: string | null;
  affiliateNote?: string | null;
  commissionPercent?: number | null;
};

export function assertCouponConfig(input: CouponInput): string | null {
  const code = normalizeCouponCode(input.code);
  if (code.length < 3) return "Code must be at least 3 characters.";
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    return "Code may only use letters, numbers, hyphens, and underscores.";
  }
  if (input.type === "PERCENT") {
    const p = input.percentOff ?? 0;
    if (p < 1 || p > 100) return "Percent off must be between 1 and 100.";
  } else {
    const a = input.amountOffCents ?? 0;
    if (a < 1) return "Fixed discount must be at least $0.01.";
  }
  if (input.commissionPercent != null) {
    if (input.commissionPercent < 0 || input.commissionPercent > 100) {
      return "Affiliate commission must be between 0 and 100.";
    }
  }
  if (input.startsAt && input.endsAt && input.startsAt > input.endsAt) {
    return "Start date must be before end date.";
  }
  return null;
}
