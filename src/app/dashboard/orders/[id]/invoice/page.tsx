import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/dashboard/print-button";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");

  const order = await db.order.findUnique({
    where: { id: params.id },
    include: { items: true },
  });
  if (!order || order.userId !== session.user.id) notFound();

  const shipTo = (order.shipTo ?? {}) as Record<string, string>;

  return (
    <div className="container-tight py-8">
      {/* Controls — hidden when printing */}
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/dashboard/orders/${order.id}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to order
          </Link>
        </Button>
        <PrintButton />
      </div>

      {/* Invoice sheet */}
      <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-bold tracking-tight">ElevateBioLab</p>
            <p className="text-xs text-muted-foreground">Research compounds — For Research Use Only</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">Invoice</p>
            <p className="font-mono text-sm">{order.orderNumber}</p>
            <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill / Ship to</p>
            <div className="mt-1 text-muted-foreground">
              {shipTo.fullName && <p className="text-foreground">{shipTo.fullName}</p>}
              {shipTo.street1 && <p>{shipTo.street1}{shipTo.street2 ? `, ${shipTo.street2}` : ""}</p>}
              {shipTo.city && <p>{shipTo.city}, {shipTo.state} {shipTo.zip}</p>}
              <p>{order.guestEmail ?? session.user.email}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
            <p className="mt-1">{order.status.replace(/_/g, " ")}</p>
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 text-center font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Unit</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id} className="border-b border-border">
                <td className="py-2">
                  <span className="block">{i.name}</span>
                  <span className="block text-xs text-muted-foreground">{i.sku}</span>
                </td>
                <td className="py-2 text-center">{i.quantity}</td>
                <td className="py-2 text-right">{formatPrice(i.unitPriceCents)}</td>
                <td className="py-2 text-right">{formatPrice(i.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="flex w-full max-w-xs flex-col gap-1 text-sm">
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

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          Thank you for your order. All products are supplied strictly For Research Use Only.
        </p>
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
