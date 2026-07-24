import { db } from "@/lib/db";
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
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  freeShipping: boolean;
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
 * the DB, apply bulk tiers, then layer shipping + tax. Called by checkout.
 */
export async function priceCart(
  items: { variantId: string; quantity: number }[],
  opts: { state?: string; shippingCents?: number } = {}
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
  // Authoritative — enforced here regardless of what the client/quote passed in,
  // so this can't be bypassed by an ordering flow that skips the quote step.
  const freeShipping = subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS;
  const shippingCents = freeShipping ? 0 : (opts.shippingCents ?? 0);
  const rate = opts.state ? TAX_RATES[opts.state.toUpperCase()] ?? 0 : 0;
  const taxCents = Math.round(subtotalCents * rate);
  const totalCents = subtotalCents + shippingCents + taxCents;

  return { lines, subtotalCents, shippingCents, taxCents, totalCents, freeShipping };
}
