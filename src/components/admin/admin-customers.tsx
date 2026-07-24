"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, ShieldOff, UserCog } from "lucide-react";

import { getCustomerDetail, setUserRole, type CustomerDetailDTO } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { formatDate, formatPrice } from "@/lib/utils";

export interface CustomerRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  joinedAt: string;
  orderCount: number;
  lifetimeSpendCents: number;
}

const PAGE_SIZE = 20;

export function AdminCustomers({
  customers,
  currentAdminId,
}: {
  customers: CustomerRow[];
  currentAdminId: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // Detail dialog
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<CustomerDetailDTO | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.email.toLowerCase().includes(q) || (c.name ?? "").toLowerCase().includes(q)
    );
  }, [customers, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const shown = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  async function toggleRole(c: CustomerRow) {
    setBusyId(c.id);
    const nextRole = c.role === "ADMIN" ? "CUSTOMER" : "ADMIN";
    try {
      const res = await setUserRole({ userId: c.id, role: nextRole });
      if (res.ok) {
        toast({ title: "Role updated", description: `${c.email} → ${nextRole}` });
        router.refresh();
      } else {
        toast({ title: "Couldn't change role", description: res.error, variant: "destructive" });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function openDetail(id: string) {
    setDetail(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await getCustomerDetail(id);
      if (res.ok && res.customer) setDetail(res.customer);
      else toast({ title: "Couldn't load customer", description: res.error, variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="Search by name or email"
          className="max-w-xs"
          aria-label="Search customers"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length} customer{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No customers match.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{c.name ?? "—"}</span>
                  <Badge variant={c.role === "ADMIN" ? "default" : "outline"} className="font-normal">
                    {c.role}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{c.email}</p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>{c.orderCount} order{c.orderCount === 1 ? "" : "s"}</span>
                <span className="font-semibold text-foreground">{formatPrice(c.lifetimeSpendCents)}</span>
                <span>since {formatDate(c.joinedAt)}</span>
              </div>

              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => openDetail(c.id)}>
                  <UserCog className="mr-1.5 h-3.5 w-3.5" />
                  View
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === c.id || c.id === currentAdminId}
                  title={c.id === currentAdminId ? "You can't change your own role" : undefined}
                  onClick={() => toggleRole(c)}
                >
                  {busyId === c.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : c.role === "ADMIN" ? (
                    <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {c.role === "ADMIN" ? "Demote" : "Make admin"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={clampedPage <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="px-2 text-sm text-muted-foreground">Page {clampedPage} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={clampedPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail ? (detail.name ?? detail.email) : "Customer"}</DialogTitle>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span className="text-muted-foreground">{detail.email}</span>
                <span>Lifetime spend <span className="font-semibold">{formatPrice(detail.lifetimeSpendCents)}</span></span>
                <span>Joined {formatDate(detail.joinedAt)}</span>
              </div>

              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Orders ({detail.orders.length})
                </h3>
                {detail.orders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No orders.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {detail.orders.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-2">
                        <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs text-primary hover:underline">
                          {o.orderNumber}
                        </Link>
                        <span className="text-xs text-muted-foreground">{o.status.replace(/_/g, " ")}</span>
                        <span className="text-xs font-medium">{formatPrice(o.totalCents)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Addresses ({detail.addresses.length})
                </h3>
                {detail.addresses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No addresses.</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {detail.addresses.map((a) => (
                      <li key={a.id}>{a.fullName} — {a.city}, {a.state} {a.zip}</li>
                    ))}
                  </ul>
                )}
              </div>

              {detail.saved.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Saved items ({detail.saved.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {detail.saved.map((s) => s.label).join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminCustomers;
