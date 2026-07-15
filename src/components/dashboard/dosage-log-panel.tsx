"use client";

import * as React from "react";
import { ClipboardList, Loader2, Plus } from "lucide-react";

import { logDose } from "@/actions/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/utils";

interface DoseEntry {
  id: string;
  dateTaken: string;
  doseMcg: number;
  volumeMl: number | null;
  note: string | null;
  productName: string | null;
}

export function DosageLogPanel({ logs }: { logs: DoseEntry[] }) {
  const { toast } = useToast();
  const [doseMcg, setDoseMcg] = React.useState("");
  const [volumeMl, setVolumeMl] = React.useState("");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await logDose({
        doseMcg: Number(doseMcg),
        volumeMl: volumeMl ? Number(volumeMl) : undefined,
        note: note.trim() || undefined,
      });
      if (res.ok) {
        toast({ title: "Entry logged" });
        setDoseMcg("");
        setVolumeMl("");
        setNote("");
      } else {
        toast({
          title: "Couldn't log entry",
          description: res.error,
          variant: "destructive",
        });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr] lg:items-start">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
      >
        <h2 className="text-sm font-semibold">New log entry</h2>

        <div>
          <Label htmlFor="doseMcg" className="text-xs">
            Amount (mcg)
          </Label>
          <Input
            id="doseMcg"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            required
            value={doseMcg}
            onChange={(e) => setDoseMcg(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="volumeMl" className="text-xs">
            Volume (mL, optional)
          </Label>
          <Input
            id="volumeMl"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={volumeMl}
            onChange={(e) => setVolumeMl(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="note" className="text-xs">
            Note (optional)
          </Label>
          <Textarea
            id="note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Assay conditions, batch, observations..."
            className="mt-1"
          />
        </div>

        <Button type="submit" disabled={pending || !doseMcg}>
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Add entry
        </Button>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          A research record-keeping tool for in-vitro experiment tracking. Not a medical
          or dosing record.
        </p>
      </form>

      <div>
        {logs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold">No entries yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Log entries from here or straight from a product&apos;s reconstitution
              calculator.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Compound</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Volume</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {formatDate(log.dateTaken)}
                    </td>
                    <td className="px-3 py-2">{log.productName ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium">
                      {log.doseMcg} mcg
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {log.volumeMl != null ? `${log.volumeMl} mL` : "—"}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground">
                      {log.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default DosageLogPanel;
