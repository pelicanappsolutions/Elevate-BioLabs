"use client";

import * as React from "react";
import { Download } from "lucide-react";

import { formatDate, formatPrice } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductGallery } from "@/components/products/product-gallery";
import { AddToCartPanel } from "@/components/products/add-to-cart-panel";

interface VariantData {
  id: string;
  strengthMg: number;
  sku: string;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  reconstitutionVolumeMl: number;
  images: { id: string; url: string; alt: string | null }[];
  priceTiers: { minQty: number; unitPriceCents: number }[];
  coas: {
    id: string;
    batchLot: string;
    fileUrl: string;
    purity: string | null;
    testedOn: Date | string | null;
  }[];
}

export function ProductDetailClient({
  productId,
  productSlug,
  productName,
  variants,
}: {
  productId: string;
  productSlug: string;
  productName: string;
  variants: VariantData[];
}) {
  // variants arrives pre-sorted (sortOrder, then strengthMg ascending) — the
  // first entry is the sensible default selection.
  const [selectedVariantId, setSelectedVariantId] = React.useState(variants[0]?.id);
  const selected = variants.find((v) => v.id === selectedVariantId) ?? variants[0];

  if (!selected) return null;
  const latestCoa = selected.coas[0];

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={selected.images} productName={productName} />

        <div>
          {variants.length > 1 && (
            <div className="mb-4 max-w-xs">
              <Label htmlFor="strength" className="text-xs">
                Strength
              </Label>
              <Select value={selected.id} onValueChange={setSelectedVariantId}>
                <SelectTrigger id="strength" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id} disabled={v.stock <= 0}>
                      {v.strengthMg}mg{v.stock <= 0 ? " — out of stock" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {productName} {selected.strengthMg}mg
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">SKU {selected.sku}</p>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold">{formatPrice(selected.priceCents)}</span>
            {selected.compareAtCents != null &&
              selected.compareAtCents > selected.priceCents && (
                <span className="text-base text-muted-foreground line-through">
                  {formatPrice(selected.compareAtCents)}
                </span>
              )}
          </div>

          <div className="mt-6">
            <AddToCartPanel
              product={{
                variantId: selected.id,
                productId,
                slug: productSlug,
                name: `${productName} ${selected.strengthMg}mg`,
                sku: selected.sku,
                priceCents: selected.priceCents,
                stock: selected.stock,
                imageUrl: selected.images[0]?.url,
              }}
              tiers={selected.priceTiers.map((t) => ({
                minQty: t.minQty,
                unitPriceCents: t.unitPriceCents,
              }))}
            />
          </div>

          {/* COA download — per batch, so it swaps with the selected strength */}
          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Certificate of Analysis</h2>
            {latestCoa ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  Batch {latestCoa.batchLot}
                  {latestCoa.purity ? ` • ${latestCoa.purity}` : ""}
                  {latestCoa.testedOn ? ` • tested ${formatDate(latestCoa.testedOn)}` : ""}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {selected.coas.map((coa) => (
                    <a
                      key={coa.id}
                      href={coa.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tap inline-flex items-center gap-2 rounded-md border border-border px-3 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      <Download className="h-4 w-4 shrink-0" />
                      Batch {coa.batchLot} — HPLC / MS report (PDF)
                    </a>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                COA for the current batch is being finalized. Email us for the report on
                a specific lot.
              </p>
            )}
          </div>
        </div>
      </div>

    </>
  );
}

export default ProductDetailClient;
