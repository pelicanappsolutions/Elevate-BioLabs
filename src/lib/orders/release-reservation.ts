/**
 * Cancel / refund inventory release.
 *
 * Stock is decremented at checkout. When an order is cancelled or refunded we
 * must put it back — once. Idempotency is enforced by prior status
 * (CANCELLED/REFUNDED already released) and by InventoryLog rows keyed to orderId.
 */
import type { OrderStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { adjustStock } from "@/lib/inventory";

export type ReservableOrder = {
  id: string;
  orderNumber: string;
  items: { variantId: string; quantity: number }[];
};

/** Statuses that mean reserved checkout stock was already returned. */
export const STOCK_RELEASED_STATUSES: OrderStatus[] = ["CANCELLED", "REFUNDED"];

export async function orderStockAlreadyReleased(orderId: string): Promise<boolean> {
  const existing = await db.inventoryLog.findFirst({
    where: {
      orderId,
      reason: { in: ["RESERVATION_RELEASE", "RETURN"] },
      delta: { gt: 0 },
    },
    select: { id: true },
  });
  return !!existing;
}

/**
 * Return line-item stock for an order when transitioning into CANCELLED/REFUNDED.
 * No-ops if stock was already released for this order.
 */
export async function releaseOrderStockIfNeeded(opts: {
  orderId: string;
  previousStatus: OrderStatus;
  nextStatus: OrderStatus;
  reason: "RESERVATION_RELEASE" | "RETURN";
  note: string;
}): Promise<{ released: boolean }> {
  if (!STOCK_RELEASED_STATUSES.includes(opts.nextStatus)) {
    return { released: false };
  }
  if (STOCK_RELEASED_STATUSES.includes(opts.previousStatus)) {
    return { released: false };
  }
  if (await orderStockAlreadyReleased(opts.orderId)) {
    return { released: false };
  }

  const order = await db.order.findUnique({
    where: { id: opts.orderId },
    select: {
      id: true,
      orderNumber: true,
      items: { select: { variantId: true, quantity: true } },
    },
  });
  if (!order || order.items.length === 0) return { released: false };

  const restockErrors: Error[] = [];
  for (const item of order.items) {
    try {
      await adjustStock(
        item.variantId,
        item.quantity,
        opts.reason,
        opts.note,
        order.id
      );
    } catch (e) {
      restockErrors.push(e instanceof Error ? e : new Error(String(e)));
    }
  }

  if (restockErrors.length > 0) {
    console.error(
      "[releaseOrderStockIfNeeded] restock failed for order",
      order.orderNumber,
      restockErrors
    );
    throw new Error(
      `Order status updated but inventory release failed for ${restockErrors.length} line(s)`
    );
  }

  return { released: true };
}

export async function cancelOrderAndReleaseReservation(
  order: ReservableOrder,
  opts: {
    note: string;
    /** When set, update this payment row (webhook path). */
    paymentId?: string;
    providerRaw?: object;
    auditAction?: string;
    auditMeta?: Record<string, unknown>;
  }
): Promise<void> {
  const current = await db.order.findUnique({
    where: { id: order.id },
    select: { status: true },
  });
  if (current && STOCK_RELEASED_STATUSES.includes(current.status)) {
    return;
  }

  await db.$transaction(async (tx) => {
    if (opts.paymentId) {
      await tx.payment.update({
        where: { id: opts.paymentId },
        data: {
          status: "FAILED",
          ...(opts.providerRaw ? { providerRaw: opts.providerRaw } : {}),
        },
      });
    } else {
      await tx.payment.updateMany({
        where: {
          orderId: order.id,
          status: { notIn: ["SUCCEEDED", "REFUNDED", "FAILED"] },
        },
        data: { status: "FAILED" },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });

    await tx.auditLog.create({
      data: {
        action: opts.auditAction ?? "PAYMENT_FAILED",
        entity: "Order",
        entityId: order.id,
        meta: (opts.auditMeta ?? { note: opts.note }) as Prisma.InputJsonValue,
      },
    });
  });

  await releaseOrderStockIfNeeded({
    orderId: order.id,
    previousStatus: current?.status ?? "PENDING_PAYMENT",
    nextStatus: "CANCELLED",
    reason: "RESERVATION_RELEASE",
    note: opts.note,
  });
}
