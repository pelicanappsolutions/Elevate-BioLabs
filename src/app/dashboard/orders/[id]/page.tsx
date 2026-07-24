import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/utils";
import { ORDER_STATUS_VARIANT } from "@/lib/order-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BuyAgainButton } from "@/components/dashboard/buy-again-button";

export const metadata: Metadata = {
  title: "Order detail",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CustomerOrderDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");

  const order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: {
          variant: {
            select: {
              strengthMg: true,
              product: { select: { slug: true, name: true } },
              coas: {
                orderBy: { testedOn: "desc" },
                select: { id: true, batchLot: true, fileUrl: true, purity: true, testedOn: true },
              },
            },
          },
        },
      },
    },
  });

  // Ownership: a customer can only view their own order.
  if (!order || order.userId !== session.user.id) notFound();

  const shipTo = (order.shipTo ?? {}) as Record<string, string>;

  return (
    <div className="container-tight py-8 sm:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/dashboard">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to dashboard
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight">{order.orderNumber}</h1>
          <Badge variant={ORDER_STATUS_VARIANT[order.status]}>{order.status.replace(/_/g, " ")}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <BuyAgainButton orderId={order.id} />
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/orders/${order.id}/invoice`}>
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Invoice
            </Link>
          </Button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Placed {formatDate(order.createdAt)}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Items</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {order.items.map((i) => (
              <li key={i.id} className="flex flex-col gap-1.5 border-t border-border pt-3 first:border-0 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/products/${i.variant.product.slug}`} className="text-sm font-medium hover:text-primary">
                      {i.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{i.quantity} × {formatPrice(i.unitPriceCents)}</p>
                  </div>
                  <span className="text-sm font-semibold">{formatPrice(i.totalCents)}</span>
                </div>
                {/* COA(s) for exactly what was purchased */}
                {i.variant.coas.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {i.variant.coas.map((coa) => (
                      <a
                        key={coa.id}
                        href={coa.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                      >
                        <Download className="h-3 w-3" />
                        COA {coa.batchLot}{coa.purity ? ` • ${coa.purity}` : ""}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <Separator className="my-3" />
          <dl className="ml-auto flex max-w-xs flex-col gap-1 text-sm">
            <Row label="Subtotal" value={formatPrice(order.subtotalCents)} />
            <Row label="Shipping" value={order.shippingCents === 0 ? "Free" : formatPrice(order.shippingCents)} />
            <Row label="Tax" value={formatPrice(order.taxCents)} />
            {order.discountCents > 0 && <Row label="Discount" value={`−${formatPrice(order.discountCents)}`} />}
            <div className="mt-1 flex justify-between border-t border-border pt-1 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatPrice(order.totalCents)}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Shipping</h2>
            <div className="mt-2 text-sm text-muted-foreground">
              {shipTo.fullName && <p className="text-foreground">{shipTo.fullName}</p>}
              {shipTo.street1 && <p>{shipTo.street1}{shipTo.street2 ? `, ${shipTo.street2}` : ""}</p>}
              {shipTo.city && <p>{shipTo.city}, {shipTo.state} {shipTo.zip}</p>}
              {order.trackingNumber && (
                <a
                  href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.trackingNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-primary hover:underline"
                >
                  Track with USPS: {order.trackingNumber}
                </a>
              )}
            </div>
          </div>

          {order.status === "PENDING_PAYMENT" && (
            <Button asChild>
              <Link href={`/checkout/success?order=${order.orderNumber}`}>Complete payment</Link>
            </Button>
          )}
        </div>
      </div>
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
