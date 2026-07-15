import Link from "next/link";
import { ExternalLink, Package, Truck } from "lucide-react";
import type { Order, OrderItem, OrderStatus } from "@prisma/client";

import { formatDate, formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type OrderWithItems = Order & { items: OrderItem[] };

const STATUS_VARIANT: Record<OrderStatus, "default" | "secondary" | "outline" | "destructive" | "success"> = {
  PENDING_PAYMENT: "outline",
  AWAITING_REVIEW: "secondary",
  PAID: "success",
  PROCESSING: "default",
  SHIPPED: "default",
  DELIVERED: "success",
  CANCELLED: "destructive",
  REFUNDED: "destructive",
};

const STATUS_HELP: Partial<Record<OrderStatus, string>> = {
  PENDING_PAYMENT: "Waiting on payment to clear.",
  AWAITING_REVIEW: "We're verifying your uploaded payment proof.",
  PAID: "Payment confirmed — packing next.",
  PROCESSING: "Being packed in the lab.",
  SHIPPED: "On its way.",
};

export function OrderHistory({ orders }: { orders: OrderWithItems[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <Package className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold">No orders yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your orders and tracking will appear here.
        </p>
        <Button asChild className="mt-4">
          <Link href="/products">Browse catalog</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => (
        <div key={order.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">
                  {order.orderNumber}
                </span>
                <Badge variant={STATUS_VARIANT[order.status]}>
                  {order.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Placed {formatDate(order.createdAt)}
                {STATUS_HELP[order.status] ? ` • ${STATUS_HELP[order.status]}` : ""}
              </p>
            </div>
            <span className="text-sm font-semibold">{formatPrice(order.totalCents)}</span>
          </div>

          <Separator className="my-3" />

          <ul className="flex flex-col gap-1.5">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex justify-between gap-3 text-sm text-muted-foreground"
              >
                <span className="min-w-0 truncate">
                  {item.quantity} × {item.name}
                </span>
                <span className="shrink-0">{formatPrice(item.totalCents)}</span>
              </li>
            ))}
          </ul>

          {order.trackingNumber && (
            <>
              <Separator className="my-3" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4 text-primary" />
                  <span className="font-mono text-xs">{order.trackingNumber}</span>
                </span>
                <a
                  href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.trackingNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Track with USPS
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </>
          )}

          {order.status === "PENDING_PAYMENT" && (
            <Button asChild variant="outline" size="sm" className="mt-3 w-full sm:w-auto">
              <Link href={`/checkout/success?order=${order.orderNumber}`}>
                Complete payment
              </Link>
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

export default OrderHistory;
