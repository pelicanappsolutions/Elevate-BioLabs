"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Loader2, Search } from "lucide-react";

import { lookupBatch, type CoaLookupResult } from "@/actions/coa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

export function BatchLookup() {
  const [query, setQuery] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [results, setResults] = React.useState<CoaLookupResult[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setError(null);
    setPending(true);
    try {
      const res = await lookupBatch({ batchLot: query.trim() });
      if (!res.ok) {
        setError(res.error);
        setResults(null);
        return;
      }
      setResults(res.results);
    } catch {
      setError("Lookup failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Batch number, e.g. EBL-2026-0417"
            aria-label="Batch or lot number"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={pending || !query.trim()} className="shrink-0">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Look up
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {results && results.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          No COA found for &ldquo;{query}&rdquo;. Check the number on your vial label, or{" "}
          <a href="#contact" className="text-primary hover:underline">
            contact us
          </a>{" "}
          and we&apos;ll pull the report manually.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="mt-4 flex max-w-2xl flex-col gap-2">
          {results.map((r) => (
            <li
              key={`${r.batchLot}-${r.fileUrl}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold">{r.batchLot}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <Link href={`/products/${r.productSlug}`} className="hover:text-primary">
                    {r.productName}
                  </Link>
                  {r.purity ? ` • ${r.purity}` : ""}
                  {r.testedOn ? ` • tested ${formatDate(r.testedOn)}` : ""}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <a href={r.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  COA PDF
                </a>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default BatchLookup;
