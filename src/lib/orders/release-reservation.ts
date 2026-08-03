/**
 * Cancel an order and return stock reserved at checkout.
 *
 * Used when payment init fails after the order txn committed, and when a
 * gateway webhook reports FAILED. Keeps inventory consistent with order status.
 */
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { adjustStock } from "@/lib/inventory";

export type ReservableOrder = {
  id: string;
  orderNumber: string;
  items: { variantId: string; quantity: number }[];
};

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

  const restockErrors: Error[] = [];
  for (const item of order.items) {
    try {
      await adjustStock(
        item.variantId,
        item.quantity,
        "RESERVATION_RELEASE",
        opts.note
      );
    } catch (e) {
      restockErrors.push(e instanceof Error ? e : new Error(String(e)));
    }
  }

  if (restockErrors.length > 0) {
    console.error(
      "[cancelOrderAndReleaseReservation] restock failed for order",
      order.orderNumber,
      restockErrors
    );
    throw new Error(
      `Order cancelled but inventory release failed for ${restockErrors.length} line(s)`
    );
  }
}
