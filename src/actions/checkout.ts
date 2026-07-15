"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { checkoutSchema } from "@/lib/validations";
import { priceCart } from "@/lib/pricing";
import { decrementStock, InsufficientStockError } from "@/lib/inventory";
import { getRates, type ShippingRate } from "@/lib/shipping/usps";
import { createCharge } from "@/lib/payments/index";
import { trackMarketing } from "@/lib/email/index";
import { generateOrderNumber } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";
import type { PaymentRail, PaymentStatus } from "@prisma/client";

/** ~2oz per vial + 4oz packaging/cold-pack. */
function computeWeightOz(items: { quantity: number }[]) {
  const units = items.reduce((n, i) => n + i.quantity, 0);
  return 4 + units * 2;
}

export async function getShippingQuote(input: {
  toZip: string;
  toState?: string;
  items: { productId: string; quantity: number }[];
}): Promise<{ rates: ShippingRate[] }> {
  if (!input.toZip || input.items.length === 0) return { rates: [] };
  const rates = await getRates({
    toZip: input.toZip,
    toState: input.toState,
    weightOz: computeWeightOz(input.items),
  });
  return { rates };
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

  const rl = rateLimit(`checkout:${data.email}`, { limit: 8, windowMs: 60_000 });
  if (!rl.success) return { ok: false, error: "Too many checkout attempts. Slow down." };

  const session = await auth();
  const rail = data.rail as PaymentRail;
  const isP2P = P2P_RAILS.includes(rail);

  // 1) Authoritative shipping cost — re-quote server-side, never trust client.
  const rates = await getRates({
    toZip: data.address.zip,
    toState: data.address.state,
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
  let orderId: string;
  try {
    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: session?.user?.id ?? null,
          guestEmail: session?.user?.id ? null : data.email,
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
      });

      // reserve stock — throws InsufficientStockError / retries on version race
      for (const line of priced.lines) {
        await decrementStock(tx, line.productId, line.quantity, created.id);
      }
      return created;
    });
    orderId = order.id;
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return { ok: false, error: `${e.productName} — only ${e.available} in stock.` };
    }
    return { ok: false, error: "Could not create order. Please try again." };
  }

  // 4) Hand off to the payment adapter (router picks the rail; mock-safe).
  try {
    const charge = await createCharge(rail, {
      orderId,
      orderNumber,
      amountCents: priced.totalCents,
      currency: "USD",
      customerEmail: data.email,
      description: `Elevate Bio-Labs order ${orderNumber}`,
      successUrl: `${env.SITE_URL}/checkout/success?order=${orderNumber}`,
      cancelUrl: `${env.SITE_URL}/checkout?canceled=1`,
      metadata: { orderNumber },
    });

    await db.payment.updateMany({
      where: { orderId, rail },
      data: {
        providerRef: charge.providerRef,
        status: (isP2P ? "MANUAL_REVIEW" : "PENDING") as PaymentStatus,
      },
    });

    if (isP2P) {
      await db.order.update({ where: { id: orderId }, data: { status: "AWAITING_REVIEW" } });
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
  } catch {
    return { ok: false, error: "Payment could not be initialized. Please try another method." };
  }
}
