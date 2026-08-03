import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Clock, Package } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessCustomerOrder } from "@/lib/orders/access";
import { getAdapter } from "@/lib/payments/index";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ProofOfPaymentModal } from "@/components/checkout/proof-of-payment-modal";
import { PAYMENT_RAIL_META } from "@/lib/payments/meta";

export const metadata: Metadata = {
  title: "Order Confirmed",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const P2P_RAILS = ["P2P_ZELLE", "P2P_VENMO", "P2P_WIRE"];

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { order?: string };
}) {
  const orderNumber = searchParams.order;
  if (!orderNumber) notFound();

  // Middleware guards /checkout, but enforce session + ownership here so
  // another logged-in customer cannot open ?order=EBL-… and see ship-to PII.
  const session = await auth();
  const callback = `/checkout/success?order=${encodeURIComponent(orderNumber)}`;
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(callback)}`);

  const order = await db.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      receipts: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  // Same response for missing vs not-owned — do not leak order existence.
  if (!order || !canAccessCustomerOrder(session.user.id, order.userId)) notFound();

  const payment = order.payments[0];
  const isP2P = payment ? P2P_RAILS.includes(payment.rail) : false;
  const requiresProof = payment ? PAYMENT_RAIL_META[payment.rail].requiresProof : false;
  const hasReceipt = order.receipts.length > 0;

  // P2P has no gateway callback, so we re-derive the same display instructions
  // the adapter produced at checkout rather than persisting them.
  const instructions =
    isP2P && payment
      ? (
          await getAdapter(payment.rail).createCharge({
            orderId: order.id,
            orderNumber: order.orderNumber,
            amountCents: order.totalCents,
            currency: order.currency,
            customerEmail: order.guestEmail ?? "",
            description: `Order ${order.orderNumber}`,
            successUrl: "",
            cancelUrl: "",
          })
        ).instructions
      : undefined;

  const shipTo = (order.shipTo ?? {}) as Record<string, string>;

  return (
    <div className="container-tight max-w-2xl py-10 sm:py-16">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          {isP2P && order.status === "AWAITING_REVIEW" ? (
            <Clock className="h-7 w-7 text-primary" />
          ) : (
            <CheckCircle2 className="h-7 w-7 text-primary" />
          )}
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          {isP2P && order.status === "AWAITING_REVIEW" ? "Almost there — send payment" : "Order confirmed"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Order <span className="font-mono font-semibold">{order.orderNumber}</span> •{" "}
          {formatPrice(order.totalCents)}
        </p>
        <Badge variant="outline" className="mt-3">
          {order.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* P2P: instructions + proof upload */}
      {isP2P && instructions && (
        <div className="mt-8 rounded-lg border border-primary/40 bg-primary/5 p-4 sm:p-6">
          <h2 className="text-base font-semibold">
            Step 1 — Send {formatPrice(order.totalCents)} via {instructions.method}
          </h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">Send to</dt>
              <dd className="font-mono font-semibold">{instructions.handle}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">Memo / reference</dt>
              <dd className="font-mono font-semibold">{instructions.memo}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">Exact amount</dt>
              <dd className="font-semibold">{formatPrice(order.totalCents)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">{instructions.note}</p>

          <Separator className="my-4" />

          {requiresProof ? (
            <>
              <h2 className="text-base font-semibold">Step 2 — Upload your proof</h2>
              {hasReceipt ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                  Receipt received — an admin is verifying it now. You&apos;ll get an email
                  the moment it clears.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Attach a screenshot or PDF of the completed transfer. We match it against
                    the memo and release your order, usually within a few hours.
                  </p>
                  <div className="mt-3">
                    <ProofOfPaymentModal
                      orderId={order.id}
                      orderNumber={order.orderNumber}
                      rail={payment!.rail}
                      amountCents={order.totalCents}
                    />
                  </div>
                </>
              )}
            </>
          ) : order.status === "AWAITING_REVIEW" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0 text-primary" />
              That&apos;s it — no upload needed. We&apos;ll match your order number against
              the payment on our end and ship it, usually within a few hours. You&apos;ll get
              a confirmation email the moment it clears.
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Payment confirmed — your order is being prepared for shipment.
            </p>
          )}
        </div>
      )}

      {/* Order detail */}
      <div className="mt-8 rounded-lg border border-border bg-card p-4 sm:p-6">
        <h2 className="text-base font-semibold">Order details</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{item.name}</span>
                <span className="block text-xs text-muted-foreground">
                  Qty {item.quantity} • {item.sku}
                </span>
              </span>
              <span className="shrink-0 font-medium">{formatPrice(item.totalCents)}</span>
            </li>
          ))}
        </ul>

        <Separator className="my-4" />

        <dl className="flex flex-col gap-2 text-sm">
          <Row label="Subtotal" value={formatPrice(order.subtotalCents)} />
          <Row label="Shipping" value={formatPrice(order.shippingCents)} />
          <Row label="Tax" value={formatPrice(order.taxCents)} />
        </dl>

        <Separator className="my-4" />

        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Total</span>
          <span className="text-xl font-bold">{formatPrice(order.totalCents)}</span>
        </div>

        {shipTo.fullName && (
          <>
            <Separator className="my-4" />
            <div className="flex gap-3">
              <Package className="h-5 w-5 shrink-0 text-primary" />
              <div className="text-sm">
                <p className="font-medium">Shipping to</p>
                <p className="text-muted-foreground">
                  {shipTo.fullName}
                  <br />
                  {shipTo.street1}
                  {shipTo.street2 ? `, ${shipTo.street2}` : ""}
                  <br />
                  {shipTo.city}, {shipTo.state} {shipTo.zip}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="outline" className="tap flex-1">
          <Link href="/products">Continue shopping</Link>
        </Button>
        <Button asChild className="tap flex-1">
          <Link href="/dashboard">Track this order</Link>
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        A confirmation email is on its way. All materials are supplied as analytical
        reference standards For Research Use Only and are not for human or veterinary
        consumption. No bacteriostatic water, injection supplies, or reconstitution
        instructions are included.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
