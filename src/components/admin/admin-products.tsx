"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2, PackagePlus, Pencil, Plus, Trash2 } from "lucide-react";

import { deleteProduct, restockProduct, upsertProduct } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatPrice } from "@/lib/utils";

interface AdminProduct {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  cas: string | null;
  purity: string | null;
  molarMass: number | null;
  sequence: string | null;
  form: string;
  storageInfo: string | null;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  lowStockThreshold: number;
  categoryId: string | null;
  categoryName: string | null;
  active: boolean;
  featured: boolean;
  coaCount: number;
  imageUrl: string | null;
}

const FORMS = ["LYOPHILIZED", "SOLUTION", "CAPSULE", "BLEND", "NASAL_SPRAY"];

interface FormState {
  id?: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  cas: string;
  purity: string;
  molarMass: string;
  sequence: string;
  form: string;
  storageInfo: string;
  price: string; // dollars in the UI, converted to cents on save
  compareAt: string;
  stock: string;
  lowStockThreshold: string;
  categoryId: string;
  active: boolean;
  featured: boolean;
}

const EMPTY: FormState = {
  sku: "",
  name: "",
  slug: "",
  description: "",
  cas: "",
  purity: "",
  molarMass: "",
  sequence: "",
  form: "LYOPHILIZED",
  storageInfo: "",
  price: "",
  compareAt: "",
  stock: "0",
  lowStockThreshold: "10",
  categoryId: "",
  active: true,
  featured: false,
};

export function AdminProducts({
  products,
  categories,
}: {
  products: AdminProduct[];
  categories: { id: string; name: string }[];
}) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [restockOpen, setRestockOpen] = React.useState<AdminProduct | null>(null);

  function openNew() {
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  }

  function openEdit(p: AdminProduct) {
    setForm({
      id: p.id,
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      description: p.description,
      cas: p.cas ?? "",
      purity: p.purity ?? "",
      molarMass: p.molarMass != null ? String(p.molarMass) : "",
      sequence: p.sequence ?? "",
      form: p.form,
      storageInfo: p.storageInfo ?? "",
      price: (p.priceCents / 100).toFixed(2),
      compareAt: p.compareAtCents != null ? (p.compareAtCents / 100).toFixed(2) : "",
      stock: String(p.stock),
      lowStockThreshold: String(p.lowStockThreshold),
      categoryId: p.categoryId ?? "",
      active: p.active,
      featured: p.featured,
    });
    setError(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await upsertProduct({
        ...(form.id ? { id: form.id } : {}),
        sku: form.sku,
        name: form.name,
        slug: form.slug || undefined,
        description: form.description,
        cas: form.cas || undefined,
        purity: form.purity || undefined,
        molarMass: form.molarMass || undefined,
        sequence: form.sequence || undefined,
        form: form.form,
        storageInfo: form.storageInfo || undefined,
        priceCents: Math.round(Number(form.price) * 100),
        compareAtCents: form.compareAt
          ? Math.round(Number(form.compareAt) * 100)
          : undefined,
        stock: Number(form.stock),
        lowStockThreshold: Number(form.lowStockThreshold),
        categoryId: form.categoryId || undefined,
        active: form.active,
        featured: form.featured,
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save the product.");
        return;
      }
      setOpen(false);
      toast({ title: form.id ? "Product updated" : "Product created" });
    } finally {
      setPending(false);
    }
  }

  async function deactivate(p: AdminProduct) {
    setBusyId(p.id);
    try {
      await deleteProduct(p.id);
      toast({
        title: "Product deactivated",
        description: "Hidden from the catalog; order history is preserved.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{products.length} products</p>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" />
          New product
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Price</th>
              <th className="px-3 py-2 font-medium">Stock</th>
              <th className="px-3 py-2 font-medium">COAs</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {p.imageUrl && (
                      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded">
                        <Image src={p.imageUrl} alt="" fill sizes="32px" className="object-cover" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">{p.sku}</span>
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {p.categoryName ?? "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{formatPrice(p.priceCents)}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      p.stock <= p.lowStockThreshold ? "font-semibold text-destructive" : ""
                    }
                  >
                    {p.stock}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{p.coaCount}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {p.active ? (
                      <Badge variant="success" className="font-normal">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="font-normal">
                        Inactive
                      </Badge>
                    )}
                    {p.featured && (
                      <Badge variant="outline" className="font-normal">
                        Featured
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRestockOpen(p)} aria-label={`Restock ${p.name}`}>
                      <PackagePlus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === p.id || !p.active}
                      onClick={() => deactivate(p)}
                      aria-label={`Deactivate ${p.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      {busyId === p.id ? (
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

      {/* Create / edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={save}>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit product" : "New product"}</DialogTitle>
            </DialogHeader>

            <div className="mt-4 grid max-h-[60vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              <T label="SKU" required value={form.sku} onChange={(v) => setForm((f) => ({ ...f, sku: v }))} />
              <T label="Name" required value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
              <T label="Slug (auto if blank)" value={form.slug} onChange={(v) => setForm((f) => ({ ...f, slug: v }))} />
              <T label="CAS number" value={form.cas} onChange={(v) => setForm((f) => ({ ...f, cas: v }))} />
              <T label="Purity" placeholder="≥99%" value={form.purity} onChange={(v) => setForm((f) => ({ ...f, purity: v }))} />
              <T label="Molar mass (g/mol)" type="number" value={form.molarMass} onChange={(v) => setForm((f) => ({ ...f, molarMass: v }))} />
              <T label="Price (USD)" required type="number" step="0.01" value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} />
              <T label="Compare-at (USD)" type="number" step="0.01" value={form.compareAt} onChange={(v) => setForm((f) => ({ ...f, compareAt: v }))} />
              <T label="Stock" required type="number" value={form.stock} onChange={(v) => setForm((f) => ({ ...f, stock: v }))} />
              <T label="Low-stock threshold" type="number" value={form.lowStockThreshold} onChange={(v) => setForm((f) => ({ ...f, lowStockThreshold: v }))} />

              <div>
                <Label className="text-xs">Form</Label>
                <Select value={form.form} onValueChange={(v) => setForm((f) => ({ ...f, form: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMS.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Category</Label>
                <Select
                  value={form.categoryId || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Uncategorized" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Uncategorized</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="sequence" className="text-xs">
                  Amino-acid sequence
                </Label>
                <Input
                  id="sequence"
                  value={form.sequence}
                  onChange={(e) => setForm((f) => ({ ...f, sequence: e.target.value }))}
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="description" className="text-xs">
                  Description (RUO-safe — describe research context, never therapeutic claims)
                </Label>
                <Textarea
                  id="description"
                  required
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="storageInfo" className="text-xs">
                  Storage instructions
                </Label>
                <Textarea
                  id="storageInfo"
                  rows={2}
                  value={form.storageInfo}
                  onChange={(e) => setForm((f) => ({ ...f, storageInfo: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-5 sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={form.active}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, active: Boolean(v) }))}
                  />
                  <span className="text-sm">Active</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={form.featured}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, featured: Boolean(v) }))}
                  />
                  <span className="text-sm">Featured on homepage</span>
                </label>
              </div>

              {error && (
                <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive sm:col-span-2">
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
                Save product
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <RestockDialog
        product={restockOpen}
        onClose={() => setRestockOpen(null)}
        onDone={(name, delta) =>
          toast({
            title: "Inventory adjusted",
            description: `${name} ${delta > 0 ? "+" : ""}${delta}`,
          })
        }
      />
    </div>
  );
}

function RestockDialog({
  product,
  onClose,
  onDone,
}: {
  product: AdminProduct | null;
  onClose: () => void;
  onDone: (name: string, delta: number) => void;
}) {
  const [delta, setDelta] = React.useState("");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (product) {
      setDelta("");
      setNote("");
      setError(null);
    }
  }, [product]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    setError(null);
    setPending(true);
    try {
      // adjustStock writes an InventoryLog and bumps Product.version, so this
      // is safe against a concurrent checkout decrementing the same row.
      const res = await restockProduct({
        productId: product.id,
        delta: Number(delta),
        note: note || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Restock failed.");
        return;
      }
      onDone(product.name, Number(delta));
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={Boolean(product)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Adjust inventory</DialogTitle>
          </DialogHeader>

          {product && (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {product.name} — current stock{" "}
                <span className="font-semibold text-foreground">{product.stock}</span>
              </p>

              <div>
                <Label htmlFor="delta" className="text-xs">
                  Change (+ to restock, − to write off)
                </Label>
                <Input
                  id="delta"
                  type="number"
                  required
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  placeholder="e.g. 50"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="restock-note" className="text-xs">
                  Note (optional)
                </Label>
                <Input
                  id="restock-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="New lot #EBL-2026-04"
                  className="mt-1"
                />
              </div>

              {delta && (
                <p className="text-xs text-muted-foreground">
                  New stock will be{" "}
                  <span className="font-semibold text-foreground">
                    {product.stock + Number(delta)}
                  </span>
                </p>
              )}

              {error && (
                <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !delta}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function T({
  label,
  value,
  onChange,
  required,
  type = "text",
  step,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  step?: string;
  placeholder?: string;
}) {
  const id = React.useId();
  return (
    <div>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
      />
    </div>
  );
}

export default AdminProducts;
