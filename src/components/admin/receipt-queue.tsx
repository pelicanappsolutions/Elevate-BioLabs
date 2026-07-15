"use client";

import * as React from "react";
import { Check, ExternalLink, Inbox, Loader2, X } from "lucide-react";
import type { PaymentRail } from "@prisma/client";

import { approveReceipt, rejectReceipt } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { formatDate, formatPrice } from "@/lib/utils";

interface QueuedReceipt {
  id: string;
  rail: PaymentRail;
  fileUrl: string;
  reference: string | null;
  amountCents: number | null;
  createdAt: string;
  order: {
    orderNumber: string;
    totalCents: number;
    guestEmail: string | null;
  };
}

export function ReceiptQueue({ receipts }: { receipts: QueuedReceipt[] }) {
  const { toast } = useToast();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  /** Approving flips the order to PAID, marks the payment SUCCEEDED, and fires
   *  the confirmation email — all inside approveReceipt's transaction. */
  async function approve(id: string, orderNumber: string) {
    setBusyId(id);
    try {
      const res = await approveReceipt(id);
      if (res.ok) {
        toast({
          title: "Payment approved",
          description: `${orderNumber} marked PAID — confirmation sent.`,
        });
      } else {
        toast({ title: "Approval failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string, orderNumber: string) {
    setBusyId(id);
    try {
      const res = await rejectReceipt(id);
      if (res.ok) {
        toast({
          title: "Receipt rejected",
          description: `${orderNumber} returned to PENDING_PAYMENT.`,
        });
      } else {
        toast({ title: "Rejection failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setBusyId(null);
    }
  }

  if (receipts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold">Queue is clear</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Zelle, Venmo, and wire receipts awaiting verification land here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Match each receipt against the order number in the memo and the exact amount
        before approving.
      </p>

      {receipts.map((r) => {
        // A mismatch here is the main fraud signal on manual rails, so surface it
        // loudly rather than leaving the admin to eyeball two numbers.
        const mismatch =
          r.amountCents != null && r.amountCents !== r.order.totalCents;

        return (
          <div key={r.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">
                    {r.order.orderNumber}
                  </span>
                  <Badge variant="outline">{r.rail.replace(/_/g, " ")}</Badge>
                  {mismatch && <Badge variant="destructive">Amount mismatch</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Uploaded {formatDate(r.createdAt)}
                  {r.order.guestEmail ? ` • ${r.order.guestEmail}` : ""}
                  {r.reference ? ` • ref ${r.reference}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">
                  {formatPrice(r.order.totalCents)}
                </p>
                {r.amountCents != null && (
                  <p
                    className={`text-xs ${mismatch ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    claimed {formatPrice(r.amountCents)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={r.fileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  View proof
                </a>
              </Button>
              <Button
                size="sm"
                disabled={busyId === r.id}
                onClick={() => approve(r.id, r.order.orderNumber)}
              >
                {busyId === r.id ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                )}
                Approve & mark paid
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === r.id}
                onClick={() => reject(r.id, r.order.orderNumber)}
                className="text-destructive hover:bg-destructive/10"
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ReceiptQueue;
