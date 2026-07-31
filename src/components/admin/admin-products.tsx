"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FlaskConical,
  ImageUp,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import {
  deleteProduct,
  deleteVariant,
  restockVariant,
  uploadVariantImage,
  upsertProduct,
  upsertVariant,
} from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
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

interface AdminVariant {
  id: string;
  sku: string;
  strengthMg: number;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  lowStockThreshold: number;
  active: boolean;
  sortOrder: number;
  coaCount: number;
  imageUrl: string | null;
  reconstitutionVolumeMl: number;
}

interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  cas: string | null;
  purity: string | null;
  molarMass: number | null;
  sequence: string | null;
  form: string;
  storageInfo: string | null;
  categoryId: string | null;
  categoryName: string | null;
  active: boolean;
  featured: boolean;
  highRisk: boolean;
  variants: AdminVariant[];
}

const FORMS = ["LYOPHILIZED", "SOLUTION", "CAPSULE", "BLEND", "NASAL_SPRAY"];

interface CompoundFormState {
  id?: string;
  name: string;
  slug: string;
  description: string;
  cas: string;
  purity: string;
  molarMass: string;
  sequence: string;
  form: string;
  storageInfo: string;
  categoryId: string;
  active: boolean;
  featured: boolean;
  highRisk: boolean;
}

const EMPTY_COMPOUND: CompoundFormState = {
  name: "",
  slug: "",
  description: "",
  cas: "",
  purity: "",
  molarMass: "",
  sequence: "",
  form: "LYOPHILIZED",
  storageInfo: "",
  categoryId: "",
  active: true,
  featured: false,
  highRisk: false,
};

export function AdminProducts({
  products,
  categories,
}: {
  products: AdminProduct[];
  categories: { id: string; name: string }[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<CompoundFormState>(EMPTY_COMPOUND);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [variantsFor, setVariantsFor] = React.useState<AdminProduct | null>(null);
  const [restockOpen, setRestockOpen] = React.useState<AdminVariant | null>(null);

  function openNew() {
    setForm(EMPTY_COMPOUND);
    setError(null);
    setOpen(true);
  }

  function openEdit(p: AdminProduct) {
    setForm({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      cas: p.cas ?? "",
      purity: p.purity ?? "",
      molarMass: p.molarMass != null ? String(p.molarMass) : "",
      sequence: p.sequence ?? "",
      form: p.form,
      storageInfo: p.storageInfo ?? "",
      categoryId: p.categoryId ?? "",
      active: p.active,
      featured: p.featured,
      highRisk: p.highRisk,
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
        name: form.name,
        slug: form.slug || undefined,
        description: form.description,
        cas: form.cas || undefined,
        purity: form.purity || undefined,
        molarMass: form.molarMass || undefined,
        sequence: form.sequence || undefined,
        form: form.form,
        storageInfo: form.storageInfo || undefined,
        categoryId: form.categoryId || undefined,
        active: form.active,
        featured: form.featured,
        highRisk: form.highRisk,
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save the product.");
        return;
      }
      setOpen(false);
      toast({ title: form.id ? "Product updated" : "Product created" });
      router.refresh();
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
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {products.length} compound{products.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" />
          New compound
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-3 font-medium">Compound</th>
              <th className="px-3 py-3 font-medium">Category</th>
              <th className="px-3 py-3 font-medium">Strengths</th>
              <th className="px-3 py-3 font-medium">Price range</th>
              <th className="px-3 py-3 font-medium">State</th>
              <th className="px-3 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="align-top">
            {products.map((p) => {
              const activeVariants = p.variants.filter((v) => v.active);
              const prices = activeVariants.map((v) => v.priceCents);
              const minPrice = prices.length ? Math.min(...prices) : null;
              const maxPrice = prices.length ? Math.max(...prices) : null;
              const thumb = activeVariants[0]?.imageUrl ?? p.variants[0]?.imageUrl ?? null;

              return (
                <tr key={p.id} className="border-t border-border align-top">
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-start gap-2">
                      {thumb && (
                        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded">
                          <Image src={thumb} alt="" fill sizes="32px" className="object-cover" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">{p.slug}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top text-muted-foreground">
                    {p.categoryName ?? "—"}
                  </td>
                  <td className="px-3 py-3 align-top">{activeVariants.length}</td>
                  <td className="whitespace-nowrap px-3 py-3 align-top">
                    {minPrice == null
                      ? "—"
                      : minPrice === maxPrice
                        ? formatPrice(minPrice)
                        : `${formatPrice(minPrice)}–${formatPrice(maxPrice as number)}`}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap items-start gap-1.5">
                      {p.active ? (
                        <Badge variant="success" className="whitespace-nowrap font-normal">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="whitespace-nowrap font-normal">
                          Inactive
                        </Badge>
                      )}
                      {p.featured && (
                        <Badge variant="outline" className="whitespace-nowrap font-normal">
                          Featured
                        </Badge>
                      )}
                      {p.highRisk && (
                        <Badge variant="destructive" className="whitespace-nowrap font-normal">
                          Category 3
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-start gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setVariantsFor(p)}
                      >
                        Manage variants
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
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create / edit compound */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={save}>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit compound" : "New compound"}</DialogTitle>
            </DialogHeader>

            <div className="mt-4 grid max-h-[60vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              <T label="Name" required value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
              <T label="Slug (auto if blank)" value={form.slug} onChange={(v) => setForm((f) => ({ ...f, slug: v }))} />
              <T label="CAS number" value={form.cas} onChange={(v) => setForm((f) => ({ ...f, cas: v }))} />
              <T label="Purity (spec)" placeholder="≥99%" value={form.purity} onChange={(v) => setForm((f) => ({ ...f, purity: v }))} />
              <T label="Molar mass (g/mol)" type="number" value={form.molarMass} onChange={(v) => setForm((f) => ({ ...f, molarMass: v }))} />

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

              <div className="flex flex-wrap gap-5 sm:col-span-2">
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
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={form.highRisk}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, highRisk: Boolean(v) }))}
                  />
                  <span className="text-sm">Category 3 (PCAC review)</span>
                </label>
              </div>

              {!form.id && (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Save the compound first, then add strengths (variants) — price, stock,
                  and photos live on each strength, not the compound itself.
                </p>
              )}

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
                Save compound
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <VariantsDialog product={variantsFor} onClose={() => setVariantsFor(null)} onRestock={setRestockOpen} />

      <RestockDialog
        variant={restockOpen}
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

interface VariantFormState {
  id?: string;
  sku: string;
  strengthMg: string;
  price: string;
  compareAt: string;
  stock: string;
  lowStockThreshold: string;
  active: boolean;
  sortOrder: string;
  imageUrl: string | null;
  /** Default analytical dilution volume — admin record, not shown to
   *  customers as a purchase option or sample-preparation protocol. */
  reconstitutionVolumeMl: string;
}

const EMPTY_VARIANT: VariantFormState = {
  sku: "",
  strengthMg: "",
  price: "",
  compareAt: "",
  stock: "0",
  lowStockThreshold: "10",
  active: true,
  sortOrder: "0",
  imageUrl: null,
  reconstitutionVolumeMl: "3",
};

/** Per-compound strength (variant) manager — list view + an inline
 *  add/edit form, kept inside one Dialog rather than stacking a second
 *  Dialog on top (Radix nested dialogs are finicky with focus/overlay). */
function VariantsDialog({
  product,
  onClose,
  onRestock,
}: {
  product: AdminProduct | null;
  onClose: () => void;
  onRestock: (v: AdminVariant) => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [editing, setEditing] = React.useState<VariantFormState | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [imageUploading, setImageUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setEditing(null);
    setError(null);
  }, [product?.id]);

  if (!product) return null;

  function openNewVariant() {
    setEditing({ ...EMPTY_VARIANT, sortOrder: String(product!.variants.length) });
    setError(null);
  }

  function openEditVariant(v: AdminVariant) {
    setEditing({
      id: v.id,
      sku: v.sku,
      strengthMg: String(v.strengthMg),
      price: (v.priceCents / 100).toFixed(2),
      compareAt: v.compareAtCents != null ? (v.compareAtCents / 100).toFixed(2) : "",
      stock: String(v.stock),
      lowStockThreshold: String(v.lowStockThreshold),
      active: v.active,
      sortOrder: String(v.sortOrder),
      imageUrl: v.imageUrl,
      reconstitutionVolumeMl: String(v.reconstitutionVolumeMl),
    });
    setError(null);
  }

  async function saveVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    setPending(true);
    try {
      const res = await upsertVariant({
        ...(editing.id ? { id: editing.id } : {}),
        productId: product!.id,
        sku: editing.sku,
        strengthMg: editing.strengthMg,
        priceCents: Math.round(Number(editing.price) * 100),
        compareAtCents: editing.compareAt ? Math.round(Number(editing.compareAt) * 100) : undefined,
        stock: Number(editing.stock),
        lowStockThreshold: Number(editing.lowStockThreshold),
        active: editing.active,
        sortOrder: Number(editing.sortOrder),
        reconstitutionVolumeMl: editing.reconstitutionVolumeMl,
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save the variant.");
        return;
      }
      toast({ title: editing.id ? "Variant updated" : "Variant added" });
      setEditing(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editing?.id) return;

    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.set("variantId", editing.id);
      fd.set("slug", product!.slug);
      fd.set("file", file);
      const res = await uploadVariantImage(fd);
      if (!res.ok) {
        toast({ variant: "destructive", title: "Upload failed", description: res.error });
        return;
      }
      setEditing((f) => (f ? { ...f, imageUrl: res.url ?? f.imageUrl } : f));
      toast({ title: "Photo updated" });
      router.refresh();
    } finally {
      setImageUploading(false);
    }
  }

  async function deactivateVariant(v: AdminVariant) {
    setBusyId(v.id);
    try {
      await deleteVariant(v.id);
      toast({ title: "Variant deactivated" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={Boolean(product)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? (
              <span className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="-ml-2 h-7 w-7"
                  onClick={() => setEditing(null)}
                  aria-label="Back to variant list"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {editing.id ? "Edit strength" : "Add strength"} — {product.name}
              </span>
            ) : (
              `Manage strengths — ${product.name}`
            )}
          </DialogTitle>
        </DialogHeader>

        {!editing ? (
          <div className="mt-4">
            <div className="mb-3 flex justify-end">
              <Button size="sm" onClick={openNewVariant}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add strength
              </Button>
            </div>
            <div className="min-w-0 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Strength</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">Stock</th>
                    <th className="px-3 py-2 font-medium">Dilution ref.</th>
                    <th className="px-3 py-2 font-medium">COAs</th>
                    <th className="px-3 py-2 font-medium">State</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((v) => (
                    <tr key={v.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{v.strengthMg}mg</td>
                      <td className="px-3 py-2 text-muted-foreground">{v.sku}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatPrice(v.priceCents)}</td>
                      <td className="px-3 py-2">
                        <span className={v.stock <= v.lowStockThreshold ? "font-semibold text-destructive" : ""}>
                          {v.stock}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{v.reconstitutionVolumeMl}mL</td>
                      <td className="px-3 py-2 text-muted-foreground">{v.coaCount}</td>
                      <td className="px-3 py-2">
                        {v.active ? (
                          <Badge variant="success" className="font-normal">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="font-normal">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditVariant(v)} aria-label={`Edit ${v.strengthMg}mg`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onRestock(v)} aria-label={`Restock ${v.strengthMg}mg`}>
                            <PackagePlus className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === v.id || !v.active}
                            onClick={() => deactivateVariant(v)}
                            aria-label={`Deactivate ${v.strengthMg}mg`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            {busyId === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {product.variants.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                        No strengths yet — add one to make this compound purchasable.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <form onSubmit={saveVariant}>
            <div className="mt-4 grid max-h-[55vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">Variant photo</Label>
                <div className="mt-1 flex items-center gap-3">
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
                    {editing.imageUrl ? (
                      <Image src={editing.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <FlaskConical className="h-6 w-6 text-primary/40" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!editing.id || imageUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {imageUploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ImageUp className="mr-1.5 h-3.5 w-3.5" />}
                      {editing.imageUrl ? "Replace photo" : "Upload photo"}
                    </Button>
                    {!editing.id && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Save the strength first, then add a photo.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <T label="SKU" required value={editing.sku} onChange={(v) => setEditing((f) => f && { ...f, sku: v })} />
              <T label="Strength (mg)" required type="number" value={editing.strengthMg} onChange={(v) => setEditing((f) => f && { ...f, strengthMg: v })} />
              <T label="Price (USD)" required type="number" value={editing.price} onChange={(v) => setEditing((f) => f && { ...f, price: v })} />
              <T label="Compare-at (USD)" type="number" value={editing.compareAt} onChange={(v) => setEditing((f) => f && { ...f, compareAt: v })} />
              <T label="Stock" required type="number" allowDecimal={false} value={editing.stock} onChange={(v) => setEditing((f) => f && { ...f, stock: v })} />
              <T label="Low-stock threshold" type="number" allowDecimal={false} value={editing.lowStockThreshold} onChange={(v) => setEditing((f) => f && { ...f, lowStockThreshold: v })} />
              <T label="Sort order" type="number" allowDecimal={false} value={editing.sortOrder} onChange={(v) => setEditing((f) => f && { ...f, sortOrder: v })} />
              <T
                label="Analytical dilution volume (mL)"
                required
                type="number"
                value={editing.reconstitutionVolumeMl}
                onChange={(v) => setEditing((f) => f && { ...f, reconstitutionVolumeMl: v })}
                placeholder="3"
              />
              <p className="text-[11px] text-muted-foreground sm:col-span-2">
                Default dilution reference volume for the analytical standard calculator.
                Record-only — not a purchase choice, not a sample-preparation protocol, and
                never described as a reconstitution instruction to customers.
              </p>

              <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
                <Checkbox
                  checked={editing.active}
                  onCheckedChange={(v) => setEditing((f) => f && { ...f, active: Boolean(v) })}
                />
                <span className="text-sm">Active</span>
              </label>

              {error && (
                <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive sm:col-span-2">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save strength
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RestockDialog({
  variant,
  onClose,
  onDone,
}: {
  variant: AdminVariant | null;
  onClose: () => void;
  onDone: (name: string, delta: number) => void;
}) {
  const router = useRouter();
  const [delta, setDelta] = React.useState("");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (variant) {
      setDelta("");
      setNote("");
      setError(null);
    }
  }, [variant]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!variant) return;
    setError(null);
    setPending(true);
    try {
      // adjustStock writes an InventoryLog and bumps ProductVariant.version, so
      // this is safe against a concurrent checkout decrementing the same row.
      const res = await restockVariant({
        variantId: variant.id,
        delta: Number(delta),
        note: note || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Restock failed.");
        return;
      }
      onDone(`${variant.strengthMg}mg (${variant.sku})`, Number(delta));
      onClose();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={Boolean(variant)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Adjust inventory</DialogTitle>
          </DialogHeader>

          {variant && (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {variant.strengthMg}mg ({variant.sku}) — current stock{" "}
                <span className="font-semibold text-foreground">{variant.stock}</span>
              </p>

              <div>
                <Label htmlFor="delta" className="text-xs">
                  Change (+ to restock, − to write off)
                </Label>
                <NumericInput
                  id="delta"
                  allowDecimal={false}
                  allowNegative
                  required
                  value={delta}
                  onChange={setDelta}
                  placeholder="e.g. 50 or -10"
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
                    {variant.stock + Number(delta)}
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
  allowDecimal = true,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: "text" | "number";
  /** Only relevant when type="number" — whether a decimal point is allowed. */
  allowDecimal?: boolean;
  placeholder?: string;
}) {
  const id = React.useId();
  return (
    <div>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {type === "number" ? (
        <NumericInput
          id={id}
          allowDecimal={allowDecimal}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="mt-1"
        />
      ) : (
        <Input
          id={id}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1"
        />
      )}
    </div>
  );
}

export default AdminProducts;
