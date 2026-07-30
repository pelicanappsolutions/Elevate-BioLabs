"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sendTransactional, trackMarketing } from "@/lib/email/index";
import type { PaymentRail } from "@prisma/client";

const P2P_RAILS: PaymentRail[] = ["P2P_ZELLE", "P2P_VENMO", "P2P_WIRE"];

/**
 * Confirm a P2P order as paid. This is the single place that flips the order
 * to PAID, marks the latest P2P payment SUCCEEDED, sends the customer their
 * confirmation, and writes an audit log.
 *
 * Can be invoked by an admin UI action (with the admin userId) or by the
 * automated email-sync cron (with actorId = null and actor = "system").
 */
export async function confirmP2pPaymentByOrder(
  orderId: string,
  options: { actorId?: string | null; actor?: string; reason?: string } = {}
): Promise<{ ok: boolean; error?: string }> {
  const { actorId = null, actor = actorId ? "admin" : "system", reason = "P2P payment confirmed" } = options;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) return { ok: false, error: "Order not found" };

  const payment = order.payments[0];
  if (!payment || !P2P_RAILS.includes(payment.rail)) {
    return { ok: false, error: "Not a P2P order" };
  }

  // Idempotency: nothing to do if already paid.
  if (order.status === "PAID" && payment.status === "SUCCEEDED") {
    return { ok: true };
  }

  await db.$transaction([
    db.order.update({ where: { id: orderId }, data: { status: "PAID" } }),
    db.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED" } }),
    db.auditLog.create({
      data: {
        userId: actorId,
        action: "P2P_PAYMENT_CONFIRMED",
        entity: "Order",
        entityId: orderId,
        meta: { rail: payment.rail, actor, reason },
      },
    }),
  ]);

  const to = order.guestEmail ?? (await customerEmail(order.userId));
  if (to) {
    await sendTransactional("ORDER_CONFIRMATION", { to, order });
    await trackMarketing("ORDER_CONFIRMATION", to, order);
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

async function customerEmail(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const u = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  return u?.email ?? null;
}
