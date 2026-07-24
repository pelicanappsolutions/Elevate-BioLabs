"use client";

import * as React from "react";
import Link from "next/link";
import type { InventoryReason } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface AuditRow {
  id: string;
  userEmail: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  meta: unknown;
  ip: string | null;
  createdAt: string;
}

export interface InventoryRow {
  id: string;
  variantName: string;
  reason: InventoryReason;
  delta: number;
  before: number;
  after: number;
  orderId: string | null;
  orderNumber: string | null;
  note: string | null;
  createdAt: string;
}

const PAGE = 25;

const REASON_VARIANT: Record<InventoryReason, "default" | "secondary" | "outline" | "destructive" | "success"> = {
  RESTOCK: "success",
  RETURN: "success",
  SALE: "secondary",
  RESERVATION_RELEASE: "secondary",
  ADJUSTMENT: "outline",
};

export function AdminActivity({
  audit,
  inventory,
}: {
  audit: AuditRow[];
  inventory: InventoryRow[];
}) {
  const [view, setView] = React.useState<"audit" | "inventory">("audit");

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-border p-0.5">
        <Button
          size="sm"
          variant={view === "audit" ? "default" : "ghost"}
          onClick={() => setView("audit")}
        >
          Audit log
        </Button>
        <Button
          size="sm"
          variant={view === "inventory" ? "default" : "ghost"}
          onClick={() => setView("inventory")}
        >
          Inventory movements
        </Button>
      </div>

      {view === "audit" ? <AuditView rows={audit} /> : <InventoryView rows={inventory} />}
    </div>
  );
}

function AuditView({ rows }: { rows: AuditRow[] }) {
  const [action, setAction] = React.useState("ALL");
  const [page, setPage] = React.useState(1);

  const actions = React.useMemo(
    () => ["ALL", ...Array.from(new Set(rows.map((r) => r.action))).sort()],
    [rows]
  );
  const filtered = action === "ALL" ? rows : rows.filter((r) => r.action === action);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const clamped = Math.min(page, totalPages);
  const shown = filtered.slice((clamped - 1) * PAGE, clamped * PAGE);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
          <SelectTrigger className="w-[220px]" aria-label="Filter by action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>{a === "ALL" ? "All actions" : a.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
      </div>

      {shown.length === 0 ? (
        <Empty label="No audit activity yet." />
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold">{r.action}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <span>{r.userEmail}</span>
                {r.entity && <span>{r.entity}{r.entityId ? `:${r.entityId.slice(0, 8)}…` : ""}</span>}
                {r.ip && <span>{r.ip}</span>}
              </div>
              {r.meta != null && Object.keys(r.meta as object).length > 0 && (
                <pre className="mt-1.5 overflow-x-auto rounded bg-secondary/50 p-2 text-[11px] text-muted-foreground">
                  {JSON.stringify(r.meta, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      <Pager page={clamped} totalPages={totalPages} setPage={setPage} />
    </div>
  );
}

function InventoryView({ rows }: { rows: InventoryRow[] }) {
  const [reason, setReason] = React.useState("ALL");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const reasons = React.useMemo(
    () => ["ALL", ...Array.from(new Set(rows.map((r) => r.reason)))],
    [rows]
  );
  const filtered = rows.filter(
    (r) =>
      (reason === "ALL" || r.reason === reason) &&
      (query.trim() === "" || r.variantName.toLowerCase().includes(query.trim().toLowerCase()))
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const clamped = Math.min(page, totalPages);
  const shown = filtered.slice((clamped - 1) * PAGE, clamped * PAGE);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="Search product"
          className="max-w-xs"
          aria-label="Search inventory movements"
        />
        <Select value={reason} onValueChange={(v) => { setReason(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]" aria-label="Filter by reason">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {reasons.map((a) => (
              <SelectItem key={a} value={a}>{a === "ALL" ? "All reasons" : a.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} movements</span>
      </div>

      {shown.length === 0 ? (
        <Empty label="No inventory movements yet." />
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{r.variantName}</span>
                  <Badge variant={REASON_VARIANT[r.reason]} className="font-normal">
                    {r.reason.replace(/_/g, " ")}
                  </Badge>
                </div>
                {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className={cn("font-semibold", r.delta >= 0 ? "text-primary" : "text-destructive")}>
                  {r.delta >= 0 ? "+" : ""}{r.delta}
                </span>
                <span>{r.before} → {r.after}</span>
                {r.orderNumber && r.orderId && (
                  <Link href={`/admin/orders/${r.orderId}`} className="font-mono text-primary hover:underline">
                    {r.orderNumber}
                  </Link>
                )}
                <span>{formatDateTime(r.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pager page={clamped} totalPages={totalPages} setPage={setPage} />
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function Pager({
  page,
  totalPages,
  setPage,
}: {
  page: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
        Previous
      </Button>
      <span className="px-2 text-sm text-muted-foreground">Page {page} of {totalPages}</span>
      <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
        Next
      </Button>
    </div>
  );
}

export default AdminActivity;
