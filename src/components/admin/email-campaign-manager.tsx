"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Send } from "lucide-react";

import { triggerCampaign } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

interface CampaignStat {
  type: string;
  status: string;
  count: number;
}

const CAMPAIGNS = [
  {
    type: "WELCOME",
    label: "Welcome series",
    description: "Intro to RUO handling, COA lookup, and first-order incentive.",
    automated: true,
  },
  {
    type: "ABANDONED_CART_24H",
    label: "Abandoned cart — 24h",
    description: "Fires automatically 24h after a started checkout with no payment.",
    automated: true,
  },
  {
    type: "ABANDONED_CART_48H",
    label: "Abandoned cart — 48h",
    description: "Second-touch reminder with a time-boxed discount.",
    automated: true,
  },
  {
    type: "ORDER_CONFIRMATION",
    label: "Order confirmation",
    description: "Transactional — sent at checkout (includes P2P payment instructions).",
    automated: true,
  },
  {
    type: "PAYMENT_RECEIVED",
    label: "Payment received / preparing",
    description: "Transactional — admin button or confirm-payment: payment got, shipping soon.",
    automated: true,
  },
  {
    type: "SHIPMENT_TRACKING",
    label: "Shipment tracking",
    description: "Transactional — fires when a shipping label is created.",
    automated: true,
  },
  {
    type: "POST_PURCHASE_REVIEW",
    label: "Post-purchase review",
    description: "Requests a review a week after delivery.",
    automated: true,
  },
  {
    type: "PROMOTIONAL",
    label: "Promotional blast",
    description: "Manual send to opted-in subscribers only — new batches, restocks, offers.",
    automated: false,
  },
];

export function EmailCampaignManager({
  recentCampaigns,
  subscriberCount = 0,
}: {
  recentCampaigns: CampaignStat[];
  subscriberCount?: number;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = React.useState<(typeof CAMPAIGNS)[number] | null>(
    null
  );
  const [pending, setPending] = React.useState(false);

  function statsFor(type: string) {
    const rows = recentCampaigns.filter((c) => c.type === type);
    const total = rows.reduce((n, r) => n + r.count, 0);
    const failed = rows
      .filter((r) => r.status === "failed")
      .reduce((n, r) => n + r.count, 0);
    return { total, failed };
  }

  async function send() {
    if (!confirming) return;
    setPending(true);
    try {
      const res = await triggerCampaign({ type: confirming.type });
      if (res.ok) {
        toast({
          title: "Campaign queued",
          description: `${res.count} recipient${res.count === 1 ? "" : "s"} queued via Klaviyo.`,
        });
        setConfirming(null);
        router.refresh();
      } else {
        toast({ title: "Send failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Automated flows are triggered by app events and run in Klaviyo. Transactional
        mail goes out through SendGrid. Counts cover the last 30 days.{" "}
        <span className="font-medium text-foreground">
          {subscriberCount} opted-in subscriber{subscriberCount === 1 ? "" : "s"}
        </span>{" "}
        stored for future promos (checkout, newsletter, account settings).
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {CAMPAIGNS.map((c) => {
          const { total, failed } = statsFor(c.type);
          return (
            <div key={c.type} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-primary" />
                  <h3 className="text-sm font-semibold">{c.label}</h3>
                </div>
                <Badge variant={c.automated ? "outline" : "secondary"} className="shrink-0 font-normal">
                  {c.automated ? "Automated" : "Manual"}
                </Badge>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">{c.description}</p>

              <div className="mt-3 flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">
                  {total} sent (30d)
                </span>
                {failed > 0 && (
                  <span className="text-destructive">{failed} failed</span>
                )}
              </div>

              {!c.automated && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => setConfirming(c)}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Send blast
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* A blast is irreversible and hits every customer — always confirm first. */}
      <Dialog open={Boolean(confirming)} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send {confirming?.label}?</DialogTitle>
            <DialogDescription>
              This queues an email to every customer on file. It can&apos;t be recalled
              once it leaves Klaviyo. Make sure the campaign content is RUO-compliant and
              free of therapeutic claims.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirming(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={send} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EmailCampaignManager;
