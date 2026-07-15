import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhook, railFromWebhookPath } from "@/lib/payments/index";
import { adjustStock } from "@/lib/inventory";
import { sendTransactional, trackMarketing } from "@/lib/email/index";
import type { PaymentStatus } from "@prisma/client";

/**
 * Unified payment webhook: POST /api/webhooks/payment/{rail}
 *   rail ∈ nexapay | stripe | coinbase | seamlesschex | payram
 *
 * Flow:
 *   1. Resolve the rail + verify the provider signature (adapter.verifyAndParse).
 *      Invalid signature -> 400, DB untouched.
 *   2. Look up the Payment by providerRef (idempotency: skip if already final).
 *   3. Update Payment + Order status. On SUCCEEDED: send confirmation email +
 *      marketing event. On FAILED: release the reserved inventory (we reserve at
 *      checkout with optimistic locking, so a failed charge must restock).
 *
 * The route always returns 200 on a processed/duplicate event so providers stop
 * retrying; only signature/verification failures return 4xx.
 */
export async function POST(
  req: Request,
  { params }: { params: { rail: string } }
) {
  const rail = railFromWebhookPath(params.rail);
  if (!rail) {
    return NextResponse.json({ error: "Unknown rail" }, { status: 404 });
  }

  const rawBody = await req.text();

  let event;
  try {
    event = await verifyWebhook(rail, { rawBody, headers: req.headers });
  } catch {
    return NextResponse.json({ error: "Verification error" }, { status: 400 });
  }
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Find the payment this event refers to.
  const payment = await db.payment.findFirst({
    where: { providerRef: event.providerRef, rail },
    include: { order: { include: { items: true } } },
  });
  if (!payment) {
    // Nothing to reconcile — ack so the provider stops retrying.
    return NextResponse.json({ received: true, matched: false });
  }

  // Idempotency: if already in a terminal state, ack without re-processing.
  const terminal: PaymentStatus[] = ["SUCCEEDED", "REFUNDED", "FAILED"];
  if (terminal.includes(payment.status)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const order = payment.order;

  if (event.status === "SUCCEEDED") {
    await db.$transaction([
      db.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCEEDED",
          feeCents: event.feeCents,
          providerRaw: event.raw as object,
        },
      }),
      db.order.update({ where: { id: order.id }, data: { status: "PAID" } }),
      db.auditLog.create({
        data: {
          action: "PAYMENT_SUCCEEDED",
          entity: "Order",
          entityId: order.id,
          meta: { rail, providerRef: event.providerRef },
        },
      }),
    ]);

    const to = order.guestEmail ?? (await emailForUser(order.userId));
    if (to) {
      await sendTransactional("ORDER_CONFIRMATION", { to, order });
      await trackMarketing("ORDER_CONFIRMATION", to, order);
    }
  } else if (event.status === "FAILED") {
    // Release reserved stock back to inventory.
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", providerRaw: event.raw as object },
    });
    await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    for (const item of order.items) {
      await adjustStock(item.productId, item.quantity, "RESERVATION_RELEASE", `Failed payment ${order.orderNumber}`).catch(
        () => {}
      );
    }
  } else if (event.status === "REFUNDED") {
    await db.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
    await db.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
  } else {
    // PENDING — record but keep order awaiting.
    await db.payment.update({ where: { id: payment.id }, data: { status: "PENDING" } });
  }

  return NextResponse.json({ received: true });
}

async function emailForUser(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const u = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  return u?.email ?? null;
}
