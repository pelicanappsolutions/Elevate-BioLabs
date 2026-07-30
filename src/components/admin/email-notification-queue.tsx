"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Inbox, Loader2, Search, X } from "lucide-react";

import {
  confirmEmailNotification,
  ignoreEmailNotification,
} from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { formatDate, formatPrice } from "@/lib/utils";

interface QueuedNotification {
  id: string;
  source: string;
  fromEmail: string;
  subject: string;
  amountCents: number | null;
  orderNumber: string | null;
  memo: string | null;
  status: string;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    totalCents: number;
    status: string;
    rail: string | null;
    guestEmail: string | null;
  } | null;
}

export function EmailNotificationQueue({
  notifications: initial,
}: {
  notifications: QueuedNotification[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const visible = search.trim()
    ? initial.filter(
        (n) =>
          n.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
          n.fromEmail.toLowerCase().includes(search.toLowerCase()) ||
          n.subject.toLowerCase().includes(search.toLowerCase())
      )
    : initial;

  async function confirm(id: string, orderId: string | undefined, orderNumber: string | null) {
    if (!orderId) {
      toast({ title: "Cannot confirm", description: "No order linked.", variant: "destructive" });
      return;
    }
    setBusyId(id);
    try {
      const res = await confirmEmailNotification(id, orderId);
      if (res.ok) {
        toast({
          title: "Payment confirmed",
          description: `${orderNumber ?? orderId} marked PAID from email notification.`,
        });
        router.refresh();
      } else {
        toast({ title: "Confirm failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function ignore(id: string) {
    setBusyId(id);
    try {
      const res = await ignoreEmailNotification(id);
      if (res.ok) {
        toast({ title: "Notification ignored" });
        router.refresh();
      } else {
        toast({ title: "Ignore failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setBusyId(null);
    }
  }

  if (initial.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold">Email queue is clear</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Venmo/Zelle notifications that need manual review land here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by order number, sender, or subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Auto-confirmation happens only when the memo, order number, and amount all match. Review
        everything else manually to avoid misattributing payments.
      </p>

      {visible.map((n) => {
        const mismatch =
          n.order != null && n.amountCents != null && n.amountCents !== n.order.totalCents;
        const canConfirm = n.order && n.order.status !== "PAID" && !mismatch;

        return (
          <div key={n.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{n.source}</Badge>
                  {n.orderNumber ? (
                    <span className="font-mono text-sm font-semibold">{n.orderNumber}</span>
                  ) : (
                    <Badge variant="destructive">No order number</Badge>
                  )}
                  {mismatch && <Badge variant="destructive">Amount mismatch</Badge>}
                  {!n.order && n.orderNumber && (
                    <Badge variant="destructive">Order not found</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  From {n.fromEmail} • {formatDate(n.createdAt)}
                </p>
                <p className="mt-1 text-sm">{n.subject}</p>
                {n.memo && (
                  <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                    Memo: {n.memo}
                  </p>
                )}
              </div>
              <div className="text-right">
                {n.amountCents != null && (
                  <p className="text-sm font-semibold">{formatPrice(n.amountCents)}</p>
                )}
                {n.order && (
                  <p className="text-xs text-muted-foreground">
                    order total {formatPrice(n.order.totalCents)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busyId === n.id || !canConfirm}
                onClick={() => confirm(n.id, n.order?.id, n.order?.orderNumber ?? n.orderNumber)}
              >
                {busyId === n.id ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                )}
                Confirm & mark paid
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === n.id}
                onClick={() => ignore(n.id)}
                className="text-destructive hover:bg-destructive/10"
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Ignore
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default EmailNotificationQueue;
