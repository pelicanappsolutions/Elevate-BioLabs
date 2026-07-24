import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { variantDisplayName } from "@/lib/utils";

/**
 * Recompute a Product's denormalized catalog fields (minPriceCents,
 * maxPriceCents, inStock) from its active variants. Called after any
 * change to a variant's price/stock/active status so the catalog page can
 * filter/sort on the parent without a relation-aggregation query per request.
 */
export async function recomputeProductAggregates(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<void> {
  const variants = await tx.productVariant.findMany({
    where: { productId, active: true },
    select: { priceCents: true, stock: true },
  });

  if (variants.length === 0) {
    await tx.product.update({
      where: { id: productId },
      data: { minPriceCents: null, maxPriceCents: null, inStock: false },
    });
    return;
  }

  const prices = variants.map((v) => v.priceCents);
  await tx.product.update({
    where: { id: productId },
    data: {
      minPriceCents: Math.min(...prices),
      maxPriceCents: Math.max(...prices),
      inStock: variants.some((v) => v.stock > 0),
    },
  });
}

/**
 * Decrement stock with OPTIMISTIC LOCKING.
 *
 * Prisma `updateMany` with a `where` that includes the last-read `version`
 * guarantees the row hasn't changed since we read it: if another checkout won
 * the race, `count` comes back 0 and we retry with fresh data. This prevents
 * overselling without table locks.
 */
export async function decrementStock(
  tx: Prisma.TransactionClient,
  variantId: string,
  qty: number,
  orderId?: string,
  maxRetries = 4
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        stock: true,
        version: true,
        productId: true,
        strengthMg: true,
        product: { select: { name: true } },
      },
    });
    if (!variant) throw new Error(`Product variant ${variantId} not found`);

    const available = variant.stock;
    if (available < qty) {
      throw new InsufficientStockError(
        variantDisplayName(variant.product.name, variant.strengthMg),
        available,
        qty
      );
    }

    const updated = await tx.productVariant.updateMany({
      where: { id: variantId, version: variant.version },
      data: {
        stock: { decrement: qty },
        version: { increment: 1 },
      },
    });

    if (updated.count === 1) {
      await tx.inventoryLog.create({
        data: {
          variantId,
          reason: "SALE",
          delta: -qty,
          before: variant.stock,
          after: variant.stock - qty,
          orderId,
        },
      });
      await recomputeProductAggregates(tx, variant.productId);
      return;
    }
    // lost the race — loop and re-read
  }
  throw new Error(`Could not reserve stock for ${variantId} after ${maxRetries} retries`);
}

/** Restock / manual adjust — also version-bumped for consistency. */
export async function adjustStock(
  variantId: string,
  delta: number,
  reason: "RESTOCK" | "ADJUSTMENT" | "RETURN" | "RESERVATION_RELEASE",
  note?: string
) {
  return db.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stock: true, version: true, productId: true },
    });
    const after = variant.stock + delta;
    if (after < 0) throw new Error("Adjustment would drive stock negative");

    await tx.productVariant.update({
      where: { id: variantId },
      data: { stock: after, version: { increment: 1 } },
    });
    await tx.inventoryLog.create({
      data: { variantId, reason, delta, before: variant.stock, after, note },
    });
    await recomputeProductAggregates(tx, variant.productId);
    return after;
  });
}

export class InsufficientStockError extends Error {
  constructor(
    public productName: string,
    public available: number,
    public requested: number
  ) {
    super(`Insufficient stock for ${productName}: ${available} left, ${requested} requested`);
    this.name = "InsufficientStockError";
  }
}
