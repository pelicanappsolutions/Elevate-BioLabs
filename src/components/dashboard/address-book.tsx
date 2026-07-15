"use client";

import * as React from "react";
import { Home, Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import type { Address } from "@prisma/client";

import { deleteAddress, saveAddress } from "@/actions/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

interface FormState {
  id?: string;
  label: string;
  fullName: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  isDefault: boolean;
}

const EMPTY: FormState = {
  label: "",
  fullName: "",
  street1: "",
  street2: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  isDefault: false,
};

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [pending, setPending] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function openNew() {
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  }

  function openEdit(a: Address) {
    setForm({
      id: a.id,
      label: a.label ?? "",
      fullName: a.fullName,
      street1: a.street1,
      street2: a.street2 ?? "",
      city: a.city,
      state: a.state,
      zip: a.zip,
      phone: a.phone ?? "",
      isDefault: a.isDefault,
    });
    setError(null);
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await saveAddress({
        ...(form.id ? { id: form.id } : {}),
        label: form.label || undefined,
        fullName: form.fullName,
        street1: form.street1,
        street2: form.street2 || undefined,
        city: form.city,
        state: form.state.toUpperCase(),
        zip: form.zip,
        country: "US",
        phone: form.phone || undefined,
        isDefault: form.isDefault,
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save the address.");
        return;
      }
      setOpen(false);
      toast({ title: form.id ? "Address updated" : "Address added" });
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteAddress(id);
      toast({ title: "Address removed" });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Saved addresses prefill at checkout.
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">No saved addresses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add one to speed up checkout.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">{a.label ?? a.fullName}</span>
                </div>
                {a.isDefault && <Badge variant="outline">Default</Badge>}
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                {a.fullName}
                <br />
                {a.street1}
                {a.street2 ? `, ${a.street2}` : ""}
                <br />
                {a.city}, {a.state} {a.zip}
                {a.phone ? (
                  <>
                    <br />
                    {a.phone}
                  </>
                ) : null}
              </p>

              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(a)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={deletingId === a.id}
                  onClick={() => handleDelete(a.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  {deletingId === a.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit address" : "Add address"}</DialogTitle>
            </DialogHeader>

            <div className="mt-4 flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
              <F label="Label (e.g. Lab)" value={form.label} onChange={(v) => setForm((f) => ({ ...f, label: v }))} />
              <F label="Full name" required value={form.fullName} onChange={(v) => setForm((f) => ({ ...f, fullName: v }))} autoComplete="name" />
              <F label="Street address" required value={form.street1} onChange={(v) => setForm((f) => ({ ...f, street1: v }))} autoComplete="address-line1" />
              <F label="Apt / suite" value={form.street2} onChange={(v) => setForm((f) => ({ ...f, street2: v }))} autoComplete="address-line2" />
              <div className="grid grid-cols-3 gap-2">
                <F label="City" required value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} autoComplete="address-level2" />
                <F label="State" required value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v.toUpperCase().slice(0, 2) }))} autoComplete="address-level1" />
                <F label="ZIP" required value={form.zip} onChange={(v) => setForm((f) => ({ ...f, zip: v }))} autoComplete="postal-code" />
              </div>
              <F label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} autoComplete="tel" />

              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={form.isDefault}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isDefault: Boolean(v) }))}
                />
                <span className="text-sm">Use as my default address</span>
              </label>

              {error && (
                <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save address
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({
  label,
  value,
  onChange,
  required,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  const id = React.useId();
  return (
    <div>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
      />
    </div>
  );
}

export default AddressBook;
