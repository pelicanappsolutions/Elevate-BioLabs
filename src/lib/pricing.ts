import { db } from "@/lib/db";
import { evaluateCoupon } from "@/lib/coupons";
import { resolveUnitPrice, variantDisplayName, FREE_SHIPPING_THRESHOLD_CENTS } from "@/lib/utils";

export interface PricedLine {
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  freeShipping: boolean;
  couponCode?: string;
  couponId?: string;
  commissionCents?: number;
}

// Simple destination-based sales-tax table (extend as nexus grows).
const TAX_RATES: Record<string, number> = {
  TX: 0.0825,
  CA: 0.0725,
  NY: 0.08,
  FL: 0.06,
};

/**
 * Server-authoritative re-pricing. NEVER trust client cart prices — we re-read
 * the DB, apply bulk tiers, then layer coupon + shipping + tax. Called by checkout.
 */
export async function priceCart(
  items: { variantId: string; quantity: number }[],
  opts: { state?: string; shippingCents?: number; couponCode?: string | null } = {}
): Promise<PricedCart> {
  const ids = items.map((i) => i.variantId);
  const variants = await db.productVariant.findMany({
    where: { id: { in: ids }, active: true, product: { active: true } },
    include: { priceTiers: true, product: { select: { id: true, name: true } } },
  });

  const lines: PricedLine[] = [];
  for (const item of items) {
    const v = variants.find((x) => x.id === item.variantId);
    if (!v) throw new Error(`Product ${item.variantId} unavailable`);
    const unit = resolveUnitPrice(v.priceCents, v.priceTiers, item.quantity);
    lines.push({
      productId: v.product.id,
      variantId: v.id,
      name: variantDisplayName(v.product.name, v.strengthMg),
      sku: v.sku,
      quantity: item.quantity,
      unitPriceCents: unit,
      totalCents: unit * item.quantity,
    });
  }

  const subtotalCents = lines.reduce((s, l) => s + l.totalCents, 0);

  let discountCents = 0;
  let couponCode: string | undefined;
  let couponId: string | undefined;
  let commissionCents: number | undefined;

  const rawCode = opts.couponCode?.trim();
  if (rawCode) {
    const evaluated = await evaluateCoupon(rawCode, subtotalCents);
    if (!evaluated.ok) {
      throw new Error(evaluated.error);
    }
    discountCents = evaluated.discountCents;
    couponCode = evaluated.code;
    couponId = evaluated.coupon.id;
    commissionCents = evaluated.commissionCents;
  }

  const taxableCents = Math.max(0, subtotalCents - discountCents);
  // Authoritative — enforced here regardless of what the client/quote passed in,
  // so this can't be bypassed by an ordering flow that skips the quote step.
  const freeShipping = subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS;
  const shippingCents = freeShipping ? 0 : (opts.shippingCents ?? 0);
  const rate = opts.state ? TAX_RATES[opts.state.toUpperCase()] ?? 0 : 0;
  const taxCents = Math.round(taxableCents * rate);
  const totalCents = taxableCents + shippingCents + taxCents;

  return {
    lines,
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents,
    freeShipping,
    couponCode,
    couponId,
    commissionCents,
  };
}
