import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhook, railFromWebhookPath } from "@/lib/payments/index";
import {
  cancelOrderAndReleaseReservation,
  releaseOrderStockIfNeeded,
} from "@/lib/orders/release-reservation";
import { notifyAdminNewOrder, sendTransactional, trackMarketing } from "@/lib/email/index";
import { mergePaymentProviderRaw } from "@/lib/payments/checkout-url";
import type { OrderStatus, PaymentStatus } from "@prisma/client";

/**
 * Unified payment webhook: POST /api/webhooks/payment/{rail}
 *   rail ∈ nexapay | stripe | coinbase | seamlesschex | payram
 *
 * Flow:
 *   1. Resolve the rail + verify the provider signature (adapter.verifyAndParse).
 *      Invalid / missing signature -> 400, DB untouched.
 *      Production requires a configured webhook secret per rail (unsigned
 *      bodies are only trusted in non-production MOCK mode).
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
  // NOWPayments invoices store invoice `id` as providerRef at checkout, but IPN
  // callbacks send a different `payment_id` (plus invoice_id / order_id). Match
  // all three so a paid invoice actually flips the order to PAID.
  const includeOrder = { order: { include: { items: true } } } as const;
  let payment =
    (await db.payment.findFirst({
      where: { providerRef: event.providerRef, rail },
      include: includeOrder,
    })) ??
    (event.invoiceId
      ? await db.payment.findFirst({
          where: { providerRef: event.invoiceId, rail },
          include: includeOrder,
        })
      : null) ??
    (event.orderNumber
      ? await db.payment.findFirst({
          where: { rail, order: { orderNumber: event.orderNumber } },
          include: includeOrder,
          orderBy: { createdAt: "desc" },
        })
      : null);

  if (!payment) {
    // Nothing to reconcile — ack so the provider stops retrying.
    return NextResponse.json({ received: true, matched: false });
  }

  // Keep providerRef on the live payment_id so later IPNs match directly.
  if (payment.providerRef !== event.providerRef) {
    await db.payment.update({
      where: { id: payment.id },
      data: { providerRef: event.providerRef },
    });
    payment = { ...payment, providerRef: event.providerRef };
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
          // Keep invoiceUrl from checkout; nest IPN under `ipn` for audit.
          providerRaw: mergePaymentProviderRaw(payment.providerRaw, { ipn: event.raw }),
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

    // Payment already cleared — send the "payment received" template, not a
    // second "order placed" confirmation (that was emailed at checkout).
    const to = order.guestEmail ?? (await emailForUser(order.userId));
    const paidOrder = {
      ...order,
      rail: payment.rail,
      status: "PAID" as const,
      customerEmail: to,
    };
    if (to) {
      await sendTransactional("PAYMENT_RECEIVED", { to, order: paidOrder });
      await trackMarketing("ORDER_CONFIRMATION", to, paidOrder);
    }
    // Shop inbox — notify when crypto/card actually clears (not only at place-order).
    await notifyAdminNewOrder({
      ...paidOrder,
      adminNote: `Payment confirmed via ${rail}`,
    }).catch((err) => {
      console.error("[webhook] admin payment-cleared email failed:", err);
    });
  } else if (event.status === "FAILED") {
    await cancelOrderAndReleaseReservation(
      {
        id: order.id,
        orderNumber: order.orderNumber,
        items: order.items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      },
      {
        note: `Failed payment ${order.orderNumber}`,
        paymentId: payment.id,
        providerRaw: event.raw as object,
        auditAction: "PAYMENT_FAILED",
        auditMeta: { rail, providerRef: event.providerRef },
      }
    ).catch((err) => {
      console.error("[webhook] FAILED payment cancel/restock error:", err);
    });
  } else if (event.status === "REFUNDED") {
    const previousStatus = order.status as OrderStatus;
    await db.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
    await db.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
    await releaseOrderStockIfNeeded({
      orderId: order.id,
      previousStatus,
      nextStatus: "REFUNDED",
      reason: "RETURN",
      note: `Gateway refund ${order.orderNumber}`,
    }).catch((err) => {
      console.error("[webhook] REFUNDED restock error:", err);
    });
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
