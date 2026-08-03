"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { checkoutSchema } from "@/lib/validations";
import { priceCart } from "@/lib/pricing";
import { decrementStock, InsufficientStockError } from "@/lib/inventory";
import { cancelOrderAndReleaseReservation } from "@/lib/orders/release-reservation";
import { getShippingRates, type ShippingRate } from "@/lib/shipping/index";
import { createCharge } from "@/lib/payments/index";
import { isCheckoutRailAllowed } from "@/lib/payments/available-rails";
import { notifyAdminNewOrder, sendTransactional, trackMarketing } from "@/lib/email/index";
import { recordMarketingOptIn } from "@/lib/marketing";
import { generateOrderNumber, FREE_SHIPPING_THRESHOLD_CENTS } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";
import type { PaymentRail, PaymentStatus } from "@prisma/client";

/** ~2oz per vial + 4oz packaging/cold-pack. */
function computeWeightOz(items: { quantity: number }[]) {
  const units = items.reduce((n, i) => n + i.quantity, 0);
  return 4 + units * 2;
}

export async function getShippingQuote(input: {
  toName?: string;
  toStreet1?: string;
  toStreet2?: string;
  toCity?: string;
  toState?: string;
  toZip: string;
  items: { variantId: string; quantity: number }[];
}): Promise<{ rates: ShippingRate[]; freeShipping: boolean }> {
  if (!input.toZip || input.items.length === 0) return { rates: [], freeShipping: false };
  const [rates, priced] = await Promise.all([
    getShippingRates({
      toName: input.toName,
      toStreet1: input.toStreet1,
      toStreet2: input.toStreet2,
      toCity: input.toCity,
      toState: input.toState,
      toZip: input.toZip,
      weightOz: computeWeightOz(input.items),
    }),
    // Subtotal-only pass (no shippingCents passed in) just to check the
    // free-shipping threshold for the live quote — placeOrder re-derives this
    // authoritatively itself, so this is display-only, not enforcement.
    priceCart(input.items).catch(() => null),
  ]);

  const freeShipping = (priced?.subtotalCents ?? 0) >= FREE_SHIPPING_THRESHOLD_CENTS;
  return {
    rates: freeShipping ? rates.map((r) => ({ ...r, amountCents: 0 })) : rates,
    freeShipping,
  };
}

type PlaceOrderResult =
  | {
      ok: true;
      orderNumber: string;
      redirectUrl?: string;
      instructions?: { method: string; handle: string; memo: string; note: string };
      requiresProof: boolean;
    }
  | { ok: false; error: string };

const P2P_RAILS: PaymentRail[] = ["P2P_ZELLE", "P2P_VENMO", "P2P_WIRE"];

export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid checkout data" };
  }
  const data = parsed.data;

  const rl = await rateLimit(`checkout:${data.email}`, { limit: 8, windowMs: 60_000 });
  if (!rl.success) return { ok: false, error: "Too many checkout attempts. Slow down." };

  // Require an account — every order must attribute to a trackable customer.
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Please sign in to complete your order." };
  }

  // Schema already required ageConfirm === true; persist on the account.
  await db.user
    .update({ where: { id: session.user.id }, data: { ageVerified: true } })
    .catch(() => {});

  const rail = data.rail as PaymentRail;

  // Same allowlist as the checkout UI — reject muted/unconfigured rails before
  // creating an order or touching inventory (client can still POST any enum).
  if (!isCheckoutRailAllowed(rail)) {
    return {
      ok: false,
      error: "That payment method is not available. Please choose another.",
    };
  }

  const isP2P = P2P_RAILS.includes(rail);

  // 1) Authoritative shipping cost — re-quote server-side, never trust client.
  // Prefer Shippo live/test rates when SHIPPO_API_KEY is set.
  const rates = await getShippingRates({
    toName: data.address.fullName,
    toStreet1: data.address.street1,
    toStreet2: data.address.street2,
    toCity: data.address.city,
    toState: data.address.state,
    toZip: data.address.zip,
    weightOz: computeWeightOz(data.items),
  });
  const chosen = rates.find((r) => r.service === data.shipService) ?? rates[0];
  const shippingCents = chosen?.amountCents ?? 0;

  // 2) Authoritative pricing (bulk tiers + tax + shipping).
  let priced;
  try {
    priced = await priceCart(data.items, { state: data.address.state, shippingCents });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Pricing failed" };
  }

  const orderNumber = generateOrderNumber();

  // 3) Create order + reserve inventory with OPTIMISTIC LOCKING inside one txn.
  let order: Awaited<ReturnType<typeof db.order.create>> & { items: any[]; payments: any[] };
  try {
    order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: session.user.id,
          // Always store the checkout contact email on the order for transactional
          // order mail (confirmation, payment received, shipping). This is NOT
          // marketing consent — marketingOptIn is separate.
          guestEmail: data.email.trim().toLowerCase(),
          status: "PENDING_PAYMENT",
          shipTo: data.address as object,
          subtotalCents: priced.subtotalCents,
          shippingCents: priced.shippingCents,
          taxCents: priced.taxCents,
          totalCents: priced.totalCents,
          shipService: chosen?.service ?? data.shipService,
          items: {
            create: priced.lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              name: l.name,
              sku: l.sku,
              quantity: l.quantity,
              unitPriceCents: l.unitPriceCents,
              totalCents: l.totalCents,
            })),
          },
          payments: {
            create: {
              rail,
              amountCents: priced.totalCents,
              status: (isP2P ? "MANUAL_REVIEW" : "INITIATED") as PaymentStatus,
            },
          },
        },
        include: { items: true, payments: true },
      });

      // reserve stock — throws InsufficientStockError / retries on version race
      for (const line of priced.lines) {
        await decrementStock(tx, line.variantId, line.quantity, created.id);
      }
      return created as typeof order;
    });
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return { ok: false, error: `${e.productName} — only ${e.available} in stock.` };
    }
    return { ok: false, error: "Could not create order. Please try again." };
  }

  // 4) Hand off to the payment adapter (router picks the rail; mock-safe).
  // If createCharge fails after the order txn committed, cancel + restock so
  // inventory is not left orphaned under a PENDING_PAYMENT order.
  let charge;
  try {
    charge = await createCharge(rail, {
      orderId: order.id,
      orderNumber,
      amountCents: priced.totalCents,
      currency: "USD",
      customerEmail: data.email,
      description: `ElevateBioLab order ${orderNumber}`,
      successUrl: `${env.SITE_URL}/checkout/success?order=${orderNumber}`,
      cancelUrl: `${env.SITE_URL}/checkout?canceled=1`,
      metadata: { orderNumber },
    });
  } catch (e) {
    console.error("[placeOrder] payment initialization failed:", e);
    const message = e instanceof Error ? e.message : "Unknown payment error";
    try {
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
          note: `Payment init failed ${order.orderNumber}: ${message}`,
          auditAction: "PAYMENT_INIT_FAILED",
          auditMeta: { rail, message },
        }
      );
    } catch (rollbackErr) {
      console.error(
        "[placeOrder] rollback after payment init failure also failed:",
        rollbackErr
      );
    }
    return { ok: false, error: `Payment could not be initialized. ${message}` };
  }

  await db.payment.updateMany({
    where: { orderId: order.id, rail },
    data: {
      providerRef: charge.providerRef,
      status: (isP2P ? "MANUAL_REVIEW" : "PENDING") as PaymentStatus,
    },
  });

  if (isP2P) {
    await db.order.update({ where: { id: order.id }, data: { status: "AWAITING_REVIEW" } });
  }

  const orderForEmail = {
    ...order,
    status: isP2P ? "AWAITING_REVIEW" : order.status,
    payments: order.payments,
    rail,
    instructions: charge.instructions,
    // Hosted checkout / crypto — so the confirmation email can deep-link back.
    redirectUrl: charge.redirectUrl,
    customerEmail: data.email,
    guestEmail: data.email,
  };

  // Always email the customer that the order was placed (P2P includes pay instructions).
  const customerMail = await sendTransactional("ORDER_CONFIRMATION", {
    to: data.email,
    order: orderForEmail,
  });
  if (!customerMail.ok) {
    console.error("[placeOrder] customer ORDER_CONFIRMATION failed:", customerMail.error);
  }

  // Always notify the shop inbox so ops sees every new order.
  await notifyAdminNewOrder(orderForEmail).catch((err) => {
    console.error("[placeOrder] admin new-order email failed:", err);
  });

  // Persist marketing opt-in from checkout (local list + User flag + Klaviyo).
  if (data.marketingOptIn) {
    await recordMarketingOptIn({
      email: data.email,
      source: "checkout",
      name: data.address.fullName,
      phone: data.address.phone,
      userId: session.user.id,
    }).catch(() => {});
  }

  // Marketing: fire a "started checkout"-style signal for abandoned-cart flows.
  await trackMarketing("ABANDONED_CART_24H", data.email).catch(() => {});

  return {
    ok: true,
    orderNumber,
    redirectUrl: charge.redirectUrl,
    instructions: charge.instructions,
    requiresProof: isP2P,
  };
}
