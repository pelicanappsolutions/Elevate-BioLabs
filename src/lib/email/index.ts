/**
 * Email facade — the single surface the rest of the app calls.
 *
 * - sendTransactional(): picks the right SendGrid template + subject and sends.
 *   Never throws (a failed email must not break checkout) and records a
 *   CampaignEvent row with real success/failure status.
 * - trackMarketing(): fires a Klaviyo event and records a queued CampaignEvent.
 * - subscribeNewsletter(): adds a profile to the Klaviyo list.
 *
 * All DB writes are guarded so a missing table / connection can't crash callers.
 */
import type { CampaignType } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  sendEmail,
  orderConfirmationHtml,
  paymentReceivedHtml,
  shipmentTrackingHtml,
  passwordResetHtml,
  welcomeHtml,
  newOrderAdminHtml,
} from "./sendgrid";
import { subscribeProfile, trackEvent } from "./klaviyo";

export type TransactionalType =
  | "ORDER_CONFIRMATION"
  | "PAYMENT_RECEIVED"
  | "SHIPMENT_TRACKING"
  | "PASSWORD_RESET"
  | "WELCOME"
  | "NEW_ORDER_ADMIN";

/** Which transactional sends map to a CampaignType we persist. */
const CAMPAIGN_TYPE_FOR: Partial<Record<TransactionalType, CampaignType>> = {
  ORDER_CONFIRMATION: "ORDER_CONFIRMATION",
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
  SHIPMENT_TRACKING: "SHIPMENT_TRACKING",
};

async function recordCampaignEvent(fields: {
  type: CampaignType;
  email: string;
  provider: string;
  status: string;
  orderId?: string;
}): Promise<void> {
  try {
    // Cast keeps this resilient to the exact CampaignEvent schema shape.
    await (db as any).campaignEvent.create({
      data: {
        type: fields.type,
        email: fields.email,
        provider: fields.provider,
        status: fields.status,
        orderId: fields.orderId,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] failed to record CampaignEvent:", err);
  }
}

export async function sendTransactional(
  type: TransactionalType,
  args: { to: string; order?: any; resetUrl?: string; name?: string }
): Promise<{ ok: boolean; mock?: boolean; error?: string }> {
  try {
    let subject: string;
    let html: string;

    switch (type) {
      case "ORDER_CONFIRMATION":
        subject = `Order ${args.order?.orderNumber ?? ""} confirmed`;
        html = orderConfirmationHtml(args.order ?? {});
        break;
      case "PAYMENT_RECEIVED":
        subject = `Payment received — order ${args.order?.orderNumber ?? ""} is being prepared`;
        html = paymentReceivedHtml(args.order ?? {});
        break;
      case "SHIPMENT_TRACKING":
        subject = `Your order ${args.order?.orderNumber ?? ""} has shipped`;
        html = shipmentTrackingHtml(args.order ?? {});
        break;
      case "PASSWORD_RESET":
        subject = "Reset your Elevate Bio-Labs password";
        html = passwordResetHtml(args.resetUrl ?? "#");
        break;
      case "WELCOME":
        subject = "Welcome to Elevate Bio-Labs";
        html = welcomeHtml(args.name ?? "");
        break;
      case "NEW_ORDER_ADMIN":
        subject = `New order ${args.order?.orderNumber ?? ""} — action needed`;
        html = newOrderAdminHtml(args.order ?? {});
        break;
      default: {
        const _never: never = type;
        return _never;
      }
    }

    const result = await sendEmail({
      to: args.to,
      subject,
      html,
      replyTo: env.contactEmail,
    });

    const campaignType = CAMPAIGN_TYPE_FOR[type];
    if (campaignType) {
      await recordCampaignEvent({
        type: campaignType,
        email: args.to,
        provider: "sendgrid",
        status: result.ok ? (result.mock ? "mocked" : "sent") : "failed",
        orderId: args.order?.id,
      });
    }

    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.error(
        `[email] sendTransactional(${type}) SendGrid rejected:`,
        result.status,
        result.error
      );
    }

    return { ok: result.ok, mock: result.mock, error: result.error };
  } catch (err) {
    // Never throw — email failures must not break the calling flow.
    // eslint-disable-next-line no-console
    console.error(`[email] sendTransactional(${type}) failed:`, err);
    return { ok: false, error: err instanceof Error ? err.message : "Email failed" };
  }
}

/** Notify shop inbox (info@) that a new order was placed. */
export async function notifyAdminNewOrder(order: any): Promise<void> {
  const to = env.contactEmail || env.sendgrid.fromEmail;
  if (!to) return;
  await sendTransactional("NEW_ORDER_ADMIN", {
    to,
    order: {
      ...order,
      customerEmail: order?.customerEmail ?? order?.guestEmail,
    },
  });
}

export async function trackMarketing(
  type: CampaignType,
  email: string,
  order?: any
): Promise<void> {
  try {
    await trackEvent(type, email, order ? { orderNumber: order.orderNumber } : undefined);
    await recordCampaignEvent({
      type,
      email,
      provider: "klaviyo",
      status: "queued",
      orderId: order?.id,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[email] trackMarketing(${type}) failed:`, err);
  }
}

export async function subscribeNewsletter(
  email: string,
  source?: string
): Promise<{ ok: boolean }> {
  try {
    const res = await subscribeProfile(email, source);
    return { ok: res.ok };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] subscribeNewsletter failed:", err);
    return { ok: false };
  }
}
