"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, TicketPercent } from "lucide-react";

import {
  markRedemptionPaidOut,
  setCouponActive,
  upsertCoupon,
} from "@/actions/coupons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatPrice } from "@/lib/utils";

export type AdminCouponRow = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED_CENTS";
  percentOff: number | null;
  amountOffCents: number | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  minSubtotalCents: number;
  affiliateName: string | null;
  affiliateEmail: string | null;
  affiliateNote: string | null;
  commissionPercent: number | null;
  salesCents: number;
  commissionOwedCents: number;
  commissionPaidCents: number;
};

export type AdminRedemptionRow = {
  id: string;
  code: string;
  orderNumber: string;
  orderId: string;
  discountCents: number;
  orderTotalCents: number;
  commissionCents: number;
  affiliateName: string | null;
  affiliateEmail: string | null;
  paidOut: boolean;
  createdAt: string;
};

type FormState = {
  id?: string;
  code: string;
  type: "PERCENT" | "FIXED_CENTS";
  percentOff: string;
  amountOffDollars: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
  maxRedemptions: string;
  minSubtotalDollars: string;
  affiliateName: string;
  affiliateEmail: string;
  affiliateNote: string;
  commissionPercent: string;
};

const EMPTY: FormState = {
  code: "",
  type: "PERCENT",
  percentOff: "10",
  amountOffDollars: "",
  active: true,
  startsAt: "",
  endsAt: "",
  maxRedemptions: "",
  minSubtotalDollars: "",
  affiliateName: "",
  affiliateEmail: "",
  affiliateNote: "",
  commissionPercent: "",
};

export function AdminCoupons({
  coupons,
  redemptions,
}: {
  coupons: AdminCouponRow[];
  redemptions: AdminRedemptionRow[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  function openNew() {
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  }

  function openEdit(c: AdminCouponRow) {
    setForm({
      id: c.id,
      code: c.code,
      type: c.type,
      percentOff: c.percentOff != null ? String(c.percentOff) : "",
      amountOffDollars: c.amountOffCents != null ? (c.amountOffCents / 100).toFixed(2) : "",
      active: c.active,
      startsAt: c.startsAt ? c.startsAt.slice(0, 10) : "",
      endsAt: c.endsAt ? c.endsAt.slice(0, 10) : "",
      maxRedemptions: c.maxRedemptions != null ? String(c.maxRedemptions) : "",
      minSubtotalDollars: c.minSubtotalCents ? (c.minSubtotalCents / 100).toFixed(2) : "",
      affiliateName: c.affiliateName ?? "",
      affiliateEmail: c.affiliateEmail ?? "",
      affiliateNote: c.affiliateNote ?? "",
      commissionPercent: c.commissionPercent != null ? String(c.commissionPercent) : "",
    });
    setError(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await upsertCoupon({
        ...(form.id ? { id: form.id } : {}),
        code: form.code,
        type: form.type,
        percentOff: form.type === "PERCENT" ? Number(form.percentOff) : null,
        amountOffDollars: form.type === "FIXED_CENTS" ? Number(form.amountOffDollars) : null,
        active: form.active,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
        minSubtotalDollars: form.minSubtotalDollars ? Number(form.minSubtotalDollars) : 0,
        affiliateName: form.affiliateName || null,
        affiliateEmail: form.affiliateEmail || null,
        affiliateNote: form.affiliateNote || null,
        commissionPercent: form.commissionPercent ? Number(form.commissionPercent) : null,
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save.");
        return;
      }
      toast({ title: form.id ? "Coupon updated" : "Coupon created" });
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function toggleActive(c: AdminCouponRow) {
    setBusyId(c.id);
    try {
      const res = await setCouponActive(c.id, !c.active);
      if (!res.ok) toast({ title: res.error ?? "Failed", variant: "destructive" });
      else router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function togglePaid(r: AdminRedemptionRow) {
    setBusyId(r.id);
    try {
      const res = await markRedemptionPaidOut(r.id, !r.paidOut);
      if (!res.ok) toast({ title: res.error ?? "Failed", variant: "destructive" });
      else {
        toast({ title: r.paidOut ? "Marked unpaid" : "Marked paid to affiliate" });
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  const owed = coupons.reduce((s, c) => s + c.commissionOwedCents, 0);
  const paid = coupons.reduce((s, c) => s + c.commissionPaidCents, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Coupons & affiliates</h2>
          <p className="text-sm text-muted-foreground">
            Create codes for partners. Track redemptions and mark commissions paid.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" />
          New coupon
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Active codes" value={String(coupons.filter((c) => c.active).length)} />
        <Stat label="Commission owed" value={formatPrice(owed)} />
        <Stat label="Commission paid" value={formatPrice(paid)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-3 font-medium">Code</th>
              <th className="px-3 py-3 font-medium">Discount</th>
              <th className="px-3 py-3 font-medium">Affiliate</th>
              <th className="px-3 py-3 font-medium">Uses</th>
              <th className="px-3 py-3 font-medium">Sales</th>
              <th className="px-3 py-3 font-medium">Commission</th>
              <th className="px-3 py-3 font-medium">State</th>
              <th className="px-3 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  <TicketPercent className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  No coupons yet — create one for an affiliate or promo.
                </td>
              </tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-3 font-mono font-semibold">{c.code}</td>
                  <td className="px-3 py-3">
                    {c.type === "PERCENT"
                      ? `${c.percentOff}% off`
                      : `${formatPrice(c.amountOffCents ?? 0)} off`}
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm">{c.affiliateName || "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.affiliateEmail}</div>
                    {c.commissionPercent != null ? (
                      <div className="text-xs text-muted-foreground">{c.commissionPercent}% commission</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    {c.redemptionCount}
                    {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}
                  </td>
                  <td className="px-3 py-3">{formatPrice(c.salesCents)}</td>
                  <td className="px-3 py-3">
                    <div>{formatPrice(c.commissionOwedCents + c.commissionPaidCents)} total</div>
                    <div className="text-xs text-muted-foreground">
                      {formatPrice(c.commissionOwedCents)} unpaid
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={c.active ? "success" : "secondary"}>
                      {c.active ? "Active" : "Off"}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === c.id}
                        onClick={() => void toggleActive(c)}
                      >
                        {c.active ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold">Recent redemptions</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-medium">When</th>
                <th className="px-3 py-3 font-medium">Order</th>
                <th className="px-3 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">Affiliate</th>
                <th className="px-3 py-3 font-medium">Discount</th>
                <th className="px-3 py-3 font-medium">Order total</th>
                <th className="px-3 py-3 font-medium">Commission</th>
                <th className="px-3 py-3 font-medium">Payout</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                    No redemptions yet.
                  </td>
                </tr>
              ) : (
                redemptions.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{r.orderNumber}</td>
                    <td className="px-3 py-3 font-mono">{r.code}</td>
                    <td className="px-3 py-3">
                      <div>{r.affiliateName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.affiliateEmail}</div>
                    </td>
                    <td className="px-3 py-3">−{formatPrice(r.discountCents)}</td>
                    <td className="px-3 py-3">{formatPrice(r.orderTotalCents)}</td>
                    <td className="px-3 py-3">{formatPrice(r.commissionCents)}</td>
                    <td className="px-3 py-3">
                      <Button
                        size="sm"
                        variant={r.paidOut ? "secondary" : "outline"}
                        disabled={busyId === r.id || r.commissionCents <= 0}
                        onClick={() => void togglePaid(r)}
                      >
                        {r.paidOut ? "Paid" : "Mark paid"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={save}>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit coupon" : "New coupon"}</DialogTitle>
            </DialogHeader>
            <div className="mt-4 grid max-h-[60vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">Code</Label>
                <Input
                  className="mt-1 font-mono uppercase"
                  required
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="PARTNER10"
                />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, type: v as "PERCENT" | "FIXED_CENTS" }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Percent off</SelectItem>
                    <SelectItem value="FIXED_CENTS">Fixed $ off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.type === "PERCENT" ? (
                <div>
                  <Label className="text-xs">Percent off</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={form.percentOff}
                    onChange={(e) => setForm((f) => ({ ...f, percentOff: e.target.value }))}
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Amount off ($)</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0.01}
                    step="0.01"
                    required
                    value={form.amountOffDollars}
                    onChange={(e) => setForm((f) => ({ ...f, amountOffDollars: e.target.value }))}
                  />
                </div>
              )}
              <div>
                <Label className="text-xs">Min subtotal ($)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.minSubtotalDollars}
                  onChange={(e) => setForm((f) => ({ ...f, minSubtotalDollars: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Max redemptions</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={form.maxRedemptions}
                  onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Starts</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Ends</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2 border-t border-border pt-3 text-xs font-semibold uppercase text-muted-foreground">
                Affiliate (optional)
              </div>
              <div>
                <Label className="text-xs">Affiliate name</Label>
                <Input
                  className="mt-1"
                  value={form.affiliateName}
                  onChange={(e) => setForm((f) => ({ ...f, affiliateName: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Affiliate email</Label>
                <Input
                  className="mt-1"
                  type="email"
                  value={form.affiliateEmail}
                  onChange={(e) => setForm((f) => ({ ...f, affiliateEmail: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Commission % of subtotal</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="e.g. 10"
                  value={form.commissionPercent}
                  onChange={(e) => setForm((f) => ({ ...f, commissionPercent: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Internal note</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={form.affiliateNote}
                  onChange={(e) => setForm((f) => ({ ...f, affiliateNote: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 sm:col-span-2">
                <Checkbox
                  checked={form.active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, active: Boolean(v) }))}
                />
                <span className="text-sm">Active</span>
              </label>
              {error ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive sm:col-span-2">
                  {error}
                </p>
              ) : null}
            </div>
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save coupon
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

export default AdminCoupons;
