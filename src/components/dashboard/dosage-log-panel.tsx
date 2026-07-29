"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { logDose, updateDose, deleteDose } from "@/actions/dashboard";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/utils";

interface DoseEntry {
  id: string;
  dateTaken: string;
  variantId: string | null;
  doseMcg: number;
  volumeMl: number | null;
  note: string | null;
  productName: string | null;
}

interface VariantOption {
  id: string;
  label: string;
}

const NONE = "__none__";

export function DosageLogPanel({
  logs,
  variantOptions,
}: {
  logs: DoseEntry[];
  variantOptions: VariantOption[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [doseMcg, setDoseMcg] = React.useState("");
  const [volumeMl, setVolumeMl] = React.useState("");
  const [note, setNote] = React.useState("");
  const [variantId, setVariantId] = React.useState(NONE);
  const [pending, setPending] = React.useState(false);

  const [editing, setEditing] = React.useState<DoseEntry | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await logDose({
        variantId: variantId === NONE ? undefined : variantId,
        doseMcg: Number(doseMcg),
        volumeMl: volumeMl ? Number(volumeMl) : undefined,
        note: note.trim() || undefined,
      });
      if (res.ok) {
        toast({ title: "Entry logged" });
        setDoseMcg("");
        setVolumeMl("");
        setNote("");
        setVariantId(NONE);
        router.refresh();
      } else {
        toast({ title: "Couldn't log entry", description: res.error, variant: "destructive" });
      }
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await deleteDose(id);
      if (res.ok) {
        toast({ title: "Entry deleted" });
        router.refresh();
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr] lg:items-start">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
      >
        <h2 className="text-sm font-semibold">New research record</h2>

        {variantOptions.length > 0 && (
          <div>
            <Label className="text-xs">Compound (optional)</Label>
            <Select value={variantId} onValueChange={setVariantId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Not linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not linked</SelectItem>
                {variantOptions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label htmlFor="doseMcg" className="text-xs">Analyte mass (mcg)</Label>
          <NumericInput id="doseMcg" required value={doseMcg} onChange={setDoseMcg} className="mt-1" />
        </div>

        <div>
          <Label htmlFor="volumeMl" className="text-xs">Diluent volume (mL, optional)</Label>
          <NumericInput id="volumeMl" value={volumeMl} onChange={setVolumeMl} className="mt-1" />
        </div>

        <div>
          <Label htmlFor="note" className="text-xs">Note (optional)</Label>
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
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Add entry
        </Button>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          A research record-keeping tool for in-vitro analytical experiment tracking.
          Not a medical, dosing, or sample-preparation record.
        </p>
      </form>

      <div>
        {logs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold">No entries yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Record analytical experiments from here or straight from a product&apos;s
              analytical standard calculator.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Compound</th>
                  <th className="px-3 py-2 font-medium">Analyte mass</th>
                  <th className="px-3 py-2 font-medium">Diluent volume</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(log.dateTaken)}</td>
                    <td className="px-3 py-2">{log.productName ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{log.doseMcg} mcg</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {log.volumeMl != null ? `${log.volumeMl} mL` : "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-muted-foreground">{log.note ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(log)} aria-label="Edit entry">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deletingId === log.id}
                          onClick={() => handleDelete(log.id)}
                          aria-label="Delete entry"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          {deletingId === log.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EditDoseDialog
        entry={editing}
        variantOptions={variantOptions}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); router.refresh(); }}
      />
    </div>
  );
}

function EditDoseDialog({
  entry,
  variantOptions,
  onClose,
  onSaved,
}: {
  entry: DoseEntry | null;
  variantOptions: VariantOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [doseMcg, setDoseMcg] = React.useState("");
  const [volumeMl, setVolumeMl] = React.useState("");
  const [note, setNote] = React.useState("");
  const [variantId, setVariantId] = React.useState(NONE);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (entry) {
      setDoseMcg(String(entry.doseMcg));
      setVolumeMl(entry.volumeMl != null ? String(entry.volumeMl) : "");
      setNote(entry.note ?? "");
      setVariantId(entry.variantId ?? NONE);
    }
  }, [entry]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry) return;
    setPending(true);
    try {
      const res = await updateDose(entry.id, {
        variantId: variantId === NONE ? undefined : variantId,
        doseMcg: Number(doseMcg),
        volumeMl: volumeMl ? Number(volumeMl) : undefined,
        note: note.trim() || undefined,
      });
      if (res.ok) {
        toast({ title: "Entry updated" });
        onSaved();
      } else {
        toast({ title: "Couldn't update", description: res.error, variant: "destructive" });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={Boolean(entry)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Edit research record</DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-3">
            {variantOptions.length > 0 && (
              <div>
                <Label className="text-xs">Compound (optional)</Label>
                <Select value={variantId} onValueChange={setVariantId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Not linked" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not linked</SelectItem>
                    {variantOptions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="edit-dose" className="text-xs">Analyte mass (mcg)</Label>
              <NumericInput id="edit-dose" required value={doseMcg} onChange={setDoseMcg} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="edit-vol" className="text-xs">Diluent volume (mL, optional)</Label>
              <NumericInput id="edit-vol" value={volumeMl} onChange={setVolumeMl} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="edit-note" className="text-xs">Note (optional)</Label>
              <Textarea id="edit-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending || !doseMcg}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default DosageLogPanel;
