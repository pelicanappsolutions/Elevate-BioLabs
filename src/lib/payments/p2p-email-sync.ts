import { db } from "@/lib/db";
import { fetchRecentP2pEmails, markEmailsSeen } from "./p2p-email-client";
import { parseP2pEmail } from "./p2p-email-parser";
import { confirmP2pPaymentByOrder } from "./p2p-confirm";

const P2P_RAILS = ["P2P_ZELLE", "P2P_VENMO"] as const;

export interface P2pEmailSyncResult {
  checked: number;
  autoConfirmed: number;
  needsReview: number;
  ignored: number;
  errors: number;
}

/**
 * Poll the inbound payment-notification mailbox, parse each email, and either
 * auto-confirm a matching P2P order or queue it for manual review.
 *
 * Idempotent by `messageId`. Successfully stored emails are marked as seen in
 * the inbox so they are not fetched again.
 */
export async function syncP2pEmailPayments(): Promise<P2pEmailSyncResult> {
  const result: P2pEmailSyncResult = {
    checked: 0,
    autoConfirmed: 0,
    needsReview: 0,
    ignored: 0,
    errors: 0,
  };

  const emails = await fetchRecentP2pEmails();
  result.checked = emails.length;

  const seenUids: number[] = [];

  for (const email of emails) {
    try {
      const parsed = parseP2pEmail({
        messageId: email.messageId,
        from: email.from,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });

      const existing = await db.emailPaymentNotification.findUnique({
        where: { messageId: parsed.messageId },
      });
      if (existing) {
        result.ignored++;
        seenUids.push(email.uid);
        continue;
      }

      // Only ingest emails from recognized Venmo/Zelle senders.
      if (parsed.source === "unknown") {
        await db.emailPaymentNotification.create({
          data: {
            messageId: parsed.messageId,
            source: parsed.source,
            fromEmail: parsed.fromEmail,
            subject: parsed.subject,
            rawBody: parsed.rawBody,
            amountCents: parsed.amountCents,
            orderNumber: parsed.orderNumber,
            memo: parsed.memo,
            status: "IGNORED",
          },
        });
        seenUids.push(email.uid);
        result.ignored++;
        continue;
      }

      const order = parsed.orderNumber
        ? await db.order.findUnique({
            where: { orderNumber: parsed.orderNumber },
            include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
          })
        : null;

      const rail = order?.payments[0]?.rail;
      const isP2p = rail && P2P_RAILS.includes(rail as (typeof P2P_RAILS)[number]);
      const amountMatches = order != null && parsed.amountCents === order.totalCents;
      const awaitingPayment =
        order != null && (order.status === "AWAITING_REVIEW" || order.status === "PENDING_PAYMENT");

      const canAutoConfirm = order && isP2p && amountMatches && awaitingPayment;

      if (canAutoConfirm) {
        await db.emailPaymentNotification.create({
          data: {
            messageId: parsed.messageId,
            source: parsed.source,
            fromEmail: parsed.fromEmail,
            subject: parsed.subject,
            rawBody: parsed.rawBody,
            amountCents: parsed.amountCents,
            orderNumber: parsed.orderNumber,
            memo: parsed.memo,
            status: "AUTO_CONFIRMED",
            orderId: order.id,
          },
        });

        const confirm = await confirmP2pPaymentByOrder(order.id, {
          actor: "system",
          reason: `Auto-confirmed from ${parsed.source} email notification`,
        });

        if (confirm.ok) {
          result.autoConfirmed++;
        } else {
          // Stored notification will remain and an admin can confirm manually.
          result.needsReview++;
        }
      } else {
        await db.emailPaymentNotification.create({
          data: {
            messageId: parsed.messageId,
            source: parsed.source,
            fromEmail: parsed.fromEmail,
            subject: parsed.subject,
            rawBody: parsed.rawBody,
            amountCents: parsed.amountCents,
            orderNumber: parsed.orderNumber,
            memo: parsed.memo,
            status: "NEEDS_REVIEW",
            orderId: order?.id,
          },
        });
        result.needsReview++;
      }

      seenUids.push(email.uid);
    } catch (err) {
      result.errors++;
      // eslint-disable-next-line no-console
      console.error("[p2p-email] sync error for message:", email.messageId, err);
    }
  }

  if (seenUids.length > 0) {
    await markEmailsSeen(seenUids).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[p2p-email] failed to mark emails seen:", err);
    });
  }

  return result;
}
