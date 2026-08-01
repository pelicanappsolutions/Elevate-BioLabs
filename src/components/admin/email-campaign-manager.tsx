"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Send } from "lucide-react";

import { sendPromoBlast } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

/** Transactional SendGrid mail — sent by order/admin actions, not this composer. */
const TRANSACTIONAL = [
  {
    type: "ORDER_CONFIRMATION",
    label: "Order confirmation",
    description: "Sent automatically when a customer places an order (includes payment instructions for Venmo/Zelle).",
  },
  {
    type: "PAYMENT_RECEIVED",
    label: "Payment received / preparing",
    description: "Sent from Orders when you confirm payment or press Email: payment received / preparing.",
  },
  {
    type: "SHIPMENT_TRACKING",
    label: "Shipment tracking",
    description: "Sent automatically when a shipping label is created.",
  },
  {
    type: "NEW_ORDER_ADMIN",
    label: "New order → info@",
    description: "Internal alert to info@elevatebiolab.com on every new order.",
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
  const [subject, setSubject] = React.useState("Updates from Elevate Bio-Labs");
  const [headline, setHeadline] = React.useState("What's new in the lab");
  const [body, setBody] = React.useState(
    "New analytical standards and batch releases are available.\n\nBrowse the catalog for the latest COA-backed materials."
  );
  const [testTo, setTestTo] = React.useState("info@elevatebiolab.com");
  const [pending, setPending] = React.useState(false);
  const [confirmBlast, setConfirmBlast] = React.useState(false);

  function statsFor(type: string) {
    const rows = recentCampaigns.filter((c) => c.type === type);
    const total = rows.reduce((n, r) => n + r.count, 0);
    const failed = rows
      .filter((r) => r.status === "failed")
      .reduce((n, r) => n + r.count, 0);
    return { total, failed };
  }

  const promoStats = statsFor("PROMOTIONAL");

  async function sendTest() {
    setPending(true);
    try {
      const res = await sendPromoBlast({
        subject,
        headline,
        body,
        testOnlyTo: testTo,
      });
      if (res.ok) {
        toast({
          title: "Test email sent via SendGrid",
          description: `Check ${testTo}. Footer Unsubscribe should opt that address out of marketing only.`,
        });
        router.refresh();
      } else {
        toast({ title: "Test send failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setPending(false);
    }
  }

  async function sendBlast() {
    setPending(true);
    try {
      const res = await sendPromoBlast({ subject, headline, body });
      if (res.ok) {
        toast({
          title: "Promotional blast sent",
          description: `${res.count} SendGrid email${res.count === 1 ? "" : "s"} delivered to opted-in subscribers.`,
        });
        setConfirmBlast(false);
        router.refresh();
      } else {
        toast({ title: "Blast failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-muted-foreground">
        All customer and marketing mail goes through <strong className="text-foreground">SendGrid</strong>.
        Order emails use the checkout contact address and do not require marketing opt-in.
        Promotional blasts only go to people who opted in (
        <span className="font-medium text-foreground">
          {subscriberCount} subscriber{subscriberCount === 1 ? "" : "s"}
        </span>
        ).
      </p>

      {/* ── Promo composer ── */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Compose promotional email</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Edit subject, headline, and body. Every promo includes a small Unsubscribe footer.
            </p>
          </div>
          <Badge variant="secondary" className="font-normal">
            {promoStats.total} sent (30d)
            {promoStats.failed > 0 ? ` · ${promoStats.failed} failed` : ""}
          </Badge>
        </div>

        <div className="mt-4 grid gap-3">
          <div>
            <Label htmlFor="promo-subject" className="text-xs">
              Subject line
            </Label>
            <Input
              id="promo-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="promo-headline" className="text-xs">
              Headline
            </Label>
            <Input
              id="promo-headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="promo-body" className="text-xs">
              Body
            </Label>
            <Textarea
              id="promo-body"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1"
              placeholder="Write your update… Use a blank line between paragraphs."
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Label htmlFor="promo-test-to" className="text-xs">
              Send test to
            </Label>
            <Input
              id="promo-test-to"
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !testTo.includes("@")}
            onClick={sendTest}
          >
            {pending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            Send test
          </Button>
          <Button
            size="sm"
            disabled={pending || subscriberCount === 0}
            onClick={() => setConfirmBlast(true)}
          >
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Send to {subscriberCount} subscriber{subscriberCount === 1 ? "" : "s"}
          </Button>
        </div>
      </div>

      {/* ── Transactional reference ── */}
      <div>
        <h2 className="text-base font-semibold">Transactional order emails (automatic)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          These are sent by SendGrid from checkout and the Orders page. They use the email
          saved with the order — not the marketing list.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {TRANSACTIONAL.map((c) => {
            const { total, failed } = statsFor(c.type);
            return (
              <div key={c.type} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0 text-primary" />
                    <h3 className="text-sm font-semibold">{c.label}</h3>
                  </div>
                  <Badge variant="outline" className="shrink-0 font-normal">
                    Auto
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{c.description}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {total} logged (30d)
                  {failed > 0 ? (
                    <span className="text-destructive"> · {failed} failed</span>
                  ) : null}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={confirmBlast} onOpenChange={(o) => !o && setConfirmBlast(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send promotional blast?</DialogTitle>
            <DialogDescription>
              This sends your composed email via SendGrid to {subscriberCount} opted-in
              marketing subscriber{subscriberCount === 1 ? "" : "s"}. It cannot be recalled.
              Keep copy RUO-compliant — no therapeutic claims.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
            <p className="font-medium">{subject}</p>
            <p className="mt-1 text-muted-foreground">{headline}</p>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setConfirmBlast(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={sendBlast} disabled={pending}>
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
