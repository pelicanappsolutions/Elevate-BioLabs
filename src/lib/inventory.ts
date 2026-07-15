import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

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
  productId: string,
  qty: number,
  orderId?: string,
  maxRetries = 4
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, stock: true, version: true },
    });
    if (!product) throw new Error(`Product ${productId} not found`);

    const available = product.stock;
    if (available < qty) {
      throw new InsufficientStockError(product.name, available, qty);
    }

    const updated = await tx.product.updateMany({
      where: { id: productId, version: product.version },
      data: {
        stock: { decrement: qty },
        version: { increment: 1 },
      },
    });

    if (updated.count === 1) {
      await tx.inventoryLog.create({
        data: {
          productId,
          reason: "SALE",
          delta: -qty,
          before: product.stock,
          after: product.stock - qty,
          orderId,
        },
      });
      return;
    }
    // lost the race — loop and re-read
  }
  throw new Error(`Could not reserve stock for ${productId} after ${maxRetries} retries`);
}

/** Restock / manual adjust — also version-bumped for consistency. */
export async function adjustStock(
  productId: string,
  delta: number,
  reason: "RESTOCK" | "ADJUSTMENT" | "RETURN" | "RESERVATION_RELEASE",
  note?: string
) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: productId },
      select: { stock: true, version: true },
    });
    const after = product.stock + delta;
    if (after < 0) throw new Error("Adjustment would drive stock negative");

    await tx.product.update({
      where: { id: productId },
      data: { stock: after, version: { increment: 1 } },
    });
    await tx.inventoryLog.create({
      data: { productId, reason, delta, before: product.stock, after, note },
    });
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
