"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Save } from "lucide-react";
import type { OrderStatus } from "@prisma/client";

import {
  notifyPaymentReceived,
  updateOrderStatus,
  updateOrderNotes,
  refundOrder,
} from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ORDER_STATUSES } from "@/lib/order-status";

/** Admin order-detail mutations: status change, notify email, notes edit, refund. */
export function OrderDetailActions({
  orderId,
  status,
  notes,
  trackingNumber,
}: {
  orderId: string;
  status: OrderStatus;
  notes: string;
  trackingNumber?: string | null;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [noteValue, setNoteValue] = React.useState(notes);
  const [savingNotes, setSavingNotes] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function changeStatus(next: string) {
    setBusy(true);
    try {
      const res = await updateOrderStatus({ orderId, status: next });
      if (res.ok) {
        toast({ title: "Status updated", description: next.replace(/_/g, " ") });
        router.refresh();
      } else {
        toast({ title: "Update failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const res = await updateOrderNotes({ orderId, notes: noteValue });
      if (res.ok) {
        toast({ title: "Notes saved" });
        router.refresh();
      } else {
        toast({ title: "Couldn't save notes", description: res.error, variant: "destructive" });
      }
    } finally {
      setSavingNotes(false);
    }
  }

  async function doRefund() {
    setBusy(true);
    try {
      const res = await refundOrder(orderId);
      if (res.ok) {
        toast({ title: "Order refunded" });
        router.refresh();
      } else {
        toast({ title: "Refund failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function notifyCustomer() {
    setBusy(true);
    try {
      const res = await notifyPaymentReceived(orderId);
      if (res.ok) {
        toast({
          title: "Customer notified",
          description: `Payment-received email sent to ${res.emailed}.`,
        });
      } else {
        toast({ title: "Email failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  }

  const canNotify =
    !trackingNumber &&
    (status === "PAID" || status === "PROCESSING" || status === "AWAITING_REVIEW");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="text-xs">Order status</Label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={changeStatus} disabled={busy}>
            <SelectTrigger className="h-9 w-[200px]" aria-label="Change status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {status !== "REFUNDED" && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={doRefund}
              className="text-destructive hover:bg-destructive/10"
            >
              Mark refunded
            </Button>
          )}
        </div>
      </div>

      {canNotify && (
        <div>
          <Label className="text-xs">Customer email</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Tell them payment was received and the order is being prepared for shipment.
          </p>
          <Button
            size="sm"
            className="mt-2"
            disabled={busy}
            onClick={notifyCustomer}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            Email: payment received / preparing
          </Button>
        </div>
      )}

      <div>
        <Label htmlFor="order-notes" className="text-xs">Internal notes</Label>
        <Textarea
          id="order-notes"
          rows={4}
          value={noteValue}
          onChange={(e) => setNoteValue(e.target.value)}
          placeholder="Notes visible to admins only…"
          className="mt-1"
        />
        <Button
          size="sm"
          className="mt-2"
          disabled={savingNotes || noteValue === notes}
          onClick={saveNotes}
        >
          {savingNotes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save notes
        </Button>
      </div>
    </div>
  );
}

export default OrderDetailActions;
