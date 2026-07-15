import { db } from "@/lib/db";
import { resolveUnitPrice } from "@/lib/utils";

export interface PricedLine {
  productId: string;
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
  items: { productId: string; quantity: number }[],
  opts: { state?: string; shippingCents?: number } = {}
): Promise<PricedCart> {
  const ids = items.map((i) => i.productId);
  const products = await db.product.findMany({
    where: { id: { in: ids }, active: true },
    include: { priceTiers: true },
  });

  const lines: PricedLine[] = [];
  for (const item of items) {
    const p = products.find((x) => x.id === item.productId);
    if (!p) throw new Error(`Product ${item.productId} unavailable`);
    const unit = resolveUnitPrice(p.priceCents, p.priceTiers, item.quantity);
    lines.push({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      quantity: item.quantity,
      unitPriceCents: unit,
      totalCents: unit * item.quantity,
    });
  }

  const subtotalCents = lines.reduce((s, l) => s + l.totalCents, 0);
  const shippingCents = opts.shippingCents ?? 0;
  const rate = opts.state ? TAX_RATES[opts.state.toUpperCase()] ?? 0 : 0;
  const taxCents = Math.round(subtotalCents * rate);
  const totalCents = subtotalCents + shippingCents + taxCents;

  return { lines, subtotalCents, shippingCents, taxCents, totalCents };
}
