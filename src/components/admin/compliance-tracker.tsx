"use client";

import { AlertTriangle, ExternalLink, FileText, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn, formatDate } from "@/lib/utils";

interface Metric {
  id: string;
  rail: string;
  periodStart: string;
  periodEnd: string;
  txnCount: number;
  chargebacks: number;
  ratio: number;
  thresholdPct: number;
  breached: boolean;
}

interface Doc {
  id: string;
  title: string;
  slug: string;
  category: string;
  active: boolean;
  fileUrl: string | null;
  updatedAt: string;
}

// LegitScript's baseline evidence set. Anything missing here is a gap in the
// application packet, so we render the checklist from a fixed spec rather than
// only listing what happens to exist in the DB.
const REQUIRED_DOCS = [
  { category: "RUO", label: "Research Use Only policy" },
  { category: "SHIPPING_POLICY", label: "Shipping & handling policy" },
  { category: "REFUND", label: "Return / refund policy" },
  { category: "LEGITSCRIPT", label: "LegitScript application packet" },
  { category: "PRIVACY", label: "Privacy policy (GDPR/CCPA)" },
  { category: "TERMS", label: "Terms of sale" },
];

export function ComplianceTracker({
  metrics,
  docs,
}: {
  metrics: Metric[];
  docs: Doc[];
}) {
  const breached = metrics.filter((m) => m.breached);

  return (
    <div className="flex flex-col gap-6">
      {/* VAMP / chargeback thresholds */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">
            Chargeback ratio — Visa VAMP threshold
          </h2>
        </div>

        {breached.length > 0 && (
          <div className="mb-3 flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-destructive">
                {breached.length} rail{breached.length === 1 ? "" : "s"} over threshold.
              </span>{" "}
              Sustained breaches risk termination. Shift volume toward ACH, crypto, and
              P2P rails, and tighten pre-auth screening until the ratio recovers.
            </p>
          </div>
        )}

        {metrics.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No chargeback periods recorded yet. Metrics populate as gateway webhooks
            report disputes.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Rail</th>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">Txns</th>
                  <th className="px-3 py-2 font-medium">Chargebacks</th>
                  <th className="px-3 py-2 font-medium">Ratio</th>
                  <th className="px-3 py-2 font-medium">Threshold</th>
                  <th className="px-3 py-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => {
                  const pct = m.ratio * 100;
                  return (
                    <tr key={m.id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{m.rail.replace(/_/g, " ")}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                        {formatDate(m.periodStart)} – {formatDate(m.periodEnd)}
                      </td>
                      <td className="px-3 py-2">{m.txnCount}</td>
                      <td className="px-3 py-2">{m.chargebacks}</td>
                      <td
                        className={cn(
                          "px-3 py-2 font-semibold",
                          m.breached ? "text-destructive" : "text-primary"
                        )}
                      >
                        {pct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {m.thresholdPct}%
                      </td>
                      <td className="px-3 py-2">
                        {m.breached ? (
                          <Badge variant="destructive">Breached</Badge>
                        ) : (
                          <Badge variant="success">OK</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Separator />

      {/* LegitScript readiness checklist */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">LegitScript readiness</h2>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {REQUIRED_DOCS.map((req) => {
            const doc = docs.find((d) => d.category === req.category && d.active);
            return (
              <div
                key={req.category}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-lg border p-3",
                  doc ? "border-border bg-card" : "border-destructive/40 bg-destructive/5"
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{req.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {doc
                      ? `${doc.title} • updated ${formatDate(doc.updatedAt)}`
                      : "Missing — required for the application packet"}
                  </p>
                </div>
                {doc ? (
                  doc.fileUrl ? (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-primary"
                      aria-label={`Open ${doc.title}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <Badge variant="success" className="shrink-0">
                      On file
                    </Badge>
                  )
                ) : (
                  <Badge variant="destructive" className="shrink-0">
                    Missing
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Standing obligations</h3>
        <ul className="mt-2 flex flex-col gap-1.5 text-xs text-muted-foreground">
          <li>• Every shipped batch has a matching third-party COA on file.</li>
          <li>• Product copy carries no therapeutic, dosing, or human-use claims.</li>
          <li>• RUO disclaimer present on catalog, product, cart, and checkout.</li>
          <li>• Age gate and cookie consent active for all first-time visitors.</li>
          <li>• Chargeback ratio held under 1.5% (Visa VAMP, 2026) on every card rail.</li>
          <li>• Order, inventory, and receipt-approval actions written to the audit log.</li>
        </ul>
      </div>
    </div>
  );
}

export default ComplianceTracker;
