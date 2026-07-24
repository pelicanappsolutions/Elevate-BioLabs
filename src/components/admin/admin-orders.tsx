"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Truck } from "lucide-react";
import type { OrderStatus, PaymentRail } from "@prisma/client";

import Link from "next/link";

import { createShippingLabel, updateOrderStatus } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { formatDate, formatPrice } from "@/lib/utils";
import { ORDER_STATUSES, ORDER_STATUS_VARIANT } from "@/lib/order-status";

interface AdminOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: string;
  trackingNumber: string | null;
  labelUrl: string | null;
  shipService: string | null;
  guestEmail: string | null;
  shipTo: Record<string, string> | null;
  rail: PaymentRail | null;
  items: { id: string; name: string; quantity: number; totalCents: number }[];
}

const STATUSES = ORDER_STATUSES;
const VARIANT = ORDER_STATUS_VARIANT;

export function AdminOrders({ orders }: { orders: AdminOrder[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [filter, setFilter] = React.useState<string>("ALL");
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const visible =
    filter === "ALL" ? orders : orders.filter((o) => o.status === filter);

  async function changeStatus(orderId: string, status: string) {
    setBusyId(orderId);
    try {
      const res = await updateOrderStatus({ orderId, status });
      if (res.ok) {
        toast({ title: "Status updated", description: status.replace(/_/g, " ") });
        router.refresh();
      } else {
        toast({ title: "Update failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setBusyId(null);
    }
  }

  /** Buys a USPS label, flips the order to SHIPPED, and fires the tracking email
   *  — all server-side in createShippingLabel. */
  async function makeLabel(orderId: string) {
    setBusyId(orderId);
    try {
      const res = await createShippingLabel(orderId);
      if (res.ok) {
        toast({
          title: "Label created",
          description: `Tracking ${res.trackingNumber} — customer notified.`,
        });
        router.refresh();
      } else {
        toast({ title: "Label failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {visible.length} order{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No orders match this filter.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((order) => (
            <div key={order.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">
                      {order.orderNumber}
                    </span>
                    <Badge variant={VARIANT[order.status]}>
                      {order.status.replace(/_/g, " ")}
                    </Badge>
                    {order.rail && (
                      <Badge variant="outline" className="font-normal">
                        {order.rail.replace(/_/g, " ")}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(order.createdAt)} •{" "}
                    {order.shipTo?.fullName ?? order.guestEmail ?? "—"}
                    {order.shipTo
                      ? ` • ${order.shipTo.city}, ${order.shipTo.state} ${order.shipTo.zip}`
                      : ""}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                  </p>
                </div>
                <span className="text-sm font-semibold">
                  {formatPrice(order.totalCents)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/orders/${order.id}`}>View</Link>
                </Button>

                <Select
                  value={order.status}
                  onValueChange={(v) => changeStatus(order.id, v)}
                  disabled={busyId === order.id}
                >
                  <SelectTrigger className="h-9 w-[180px]" aria-label="Change status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!order.trackingNumber ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === order.id}
                    onClick={() => makeLabel(order.id)}
                  >
                    {busyId === order.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Truck className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Create USPS label
                  </Button>
                ) : (
                  <>
                    <span className="font-mono text-xs text-muted-foreground">
                      {order.trackingNumber}
                    </span>
                    {order.labelUrl && (
                      <Button asChild size="sm" variant="outline">
                        <a href={order.labelUrl} target="_blank" rel="noopener noreferrer">
                          <FileText className="mr-1.5 h-3.5 w-3.5" />
                          Label PDF
                        </a>
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminOrders;
