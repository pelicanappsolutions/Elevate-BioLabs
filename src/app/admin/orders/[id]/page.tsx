import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPrice, formatDateTime, formatDate } from "@/lib/utils";
import { ORDER_STATUS_VARIANT } from "@/lib/order-status";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { OrderDetailActions } from "@/components/admin/order-detail-actions";

export const metadata: Metadata = {
  title: "Order detail",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PAY_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive" | "success"> = {
  SUCCEEDED: "success",
  PENDING: "outline",
  INITIATED: "outline",
  MANUAL_REVIEW: "secondary",
  FAILED: "destructive",
  REFUNDED: "destructive",
};

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      receipts: { orderBy: { createdAt: "desc" } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!order) notFound();

  const shipTo = (order.shipTo ?? {}) as Record<string, string>;

  return (
    <div className="container-tight py-8 sm:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/admin">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to admin
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold tracking-tight">{order.orderNumber}</h1>
        <Badge variant={ORDER_STATUS_VARIANT[order.status]}>{order.status.replace(/_/g, " ")}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Placed {formatDateTime(order.createdAt)}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        {/* Left: items + payments */}
        <div className="flex flex-col gap-6">
          {/* Line items */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Items</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Unit</th>
                    <th className="pb-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((i) => (
                    <tr key={i.id} className="border-t border-border">
                      <td className="py-2">
                        <span className="block font-medium">{i.name}</span>
                        <span className="block text-xs text-muted-foreground">{i.sku}</span>
                      </td>
                      <td className="py-2">{i.quantity}</td>
                      <td className="py-2 text-right">{formatPrice(i.unitPriceCents)}</td>
                      <td className="py-2 text-right font-medium">{formatPrice(i.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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

          {/* Payment history */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Payment history</h2>
            {order.payments.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No payment records.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-normal">{p.rail.replace(/_/g, " ")}</Badge>
                      <Badge variant={PAY_VARIANT[p.status] ?? "default"}>{p.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {p.providerRef && <span className="font-mono">{p.providerRef}</span>}
                      {p.feeCents != null && <span>fee {formatPrice(p.feeCents)}</span>}
                      <span className="font-semibold text-foreground">{formatPrice(p.amountCents)}</span>
                      <span>{formatDateTime(p.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Attached P2P receipts */}
          {order.receipts.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Payment proof</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {order.receipts.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-normal">{r.rail.replace(/_/g, " ")}</Badge>
                      <Badge variant={r.approved ? "success" : "secondary"}>
                        {r.approved ? "Approved" : "Awaiting review"}
                      </Badge>
                      {r.reference && <span className="text-xs text-muted-foreground">ref {r.reference}</span>}
                    </div>
                    <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                      View proof
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: customer, shipping, actions */}
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Customer</h2>
            <div className="mt-2 text-sm">
              {order.user ? (
                <>
                  <p className="font-medium">{order.user.name ?? "—"}</p>
                  <Link href={`/admin?customer=${order.user.id}`} className="text-xs text-primary hover:underline">
                    {order.user.email}
                  </Link>
                </>
              ) : (
                <p className="text-muted-foreground">Guest</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Order contact email (transactional):{" "}
                <span className="font-medium text-foreground">
                  {order.guestEmail ?? order.user?.email ?? "—"}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Shipping</h2>
            <div className="mt-2 text-sm text-muted-foreground">
              {shipTo.fullName && <p className="text-foreground">{shipTo.fullName}</p>}
              {shipTo.street1 && <p>{shipTo.street1}{shipTo.street2 ? `, ${shipTo.street2}` : ""}</p>}
              {shipTo.city && <p>{shipTo.city}, {shipTo.state} {shipTo.zip}</p>}
              {order.shipService && <p className="mt-1">Service: {order.shipService.replace(/_/g, " ")}</p>}
              {order.trackingNumber && <p className="mt-1 font-mono text-xs">Tracking: {order.trackingNumber}</p>}
              {order.shippedAt && <p className="text-xs">Shipped {formatDate(order.shippedAt)}</p>}
              {order.labelUrl && (
                <a href={order.labelUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-primary hover:underline">
                  Label PDF
                </a>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Actions</h2>
            <OrderDetailActions
              orderId={order.id}
              status={order.status}
              notes={order.notes ?? ""}
              trackingNumber={order.trackingNumber}
            />
          </div>
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
