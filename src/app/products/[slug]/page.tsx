import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronRight, Download, Snowflake, Truck } from "lucide-react";

import { db } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ProductGallery } from "@/components/products/product-gallery";
import { AddToCartPanel } from "@/components/products/add-to-cart-panel";
import { DosageCalculator } from "@/components/products/dosage-calculator";
import { ProductCard } from "@/components/product-card";

export const revalidate = 120;

const FORM_LABELS: Record<string, string> = {
  LYOPHILIZED: "Lyophilized powder",
  SOLUTION: "Pre-mixed solution",
  CAPSULE: "Capsule",
  BLEND: "Blend",
  NASAL_SPRAY: "Nasal spray",
};

async function getProduct(slug: string) {
  return db.product.findFirst({
    where: { slug, active: true },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      priceTiers: { orderBy: { minQty: "asc" } },
      coas: { orderBy: { createdAt: "desc" } },
      category: true,
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    description: `${product.name} — ${product.purity ?? "research grade"}${
      product.cas ? `, CAS ${product.cas}` : ""
    }. Third-party tested with downloadable COA. For Research Use Only.`,
    openGraph: {
      title: `${product.name} | Elevate Bio-Labs`,
      images: product.images[0] ? [product.images[0].url] : [],
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = await getProduct(params.slug);
  if (!product) notFound();

  const related = await db.product.findMany({
    where: {
      active: true,
      id: { not: product.id },
      ...(product.categoryId ? { categoryId: product.categoryId } : {}),
    },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    take: 4,
  });

  const latestCoa = product.coas[0];

  return (
    <div className="container-tight py-6 sm:py-10">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-5">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground sm:text-sm">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5" />
          <li>
            <Link href="/products" className="hover:text-foreground">
              Catalog
            </Link>
          </li>
          {product.category && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <li>
                <Link
                  href={`/products?category=${product.category.slug}`}
                  className="hover:text-foreground"
                >
                  {product.category.name}
                </Link>
              </li>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5" />
          <li className="truncate font-medium text-foreground">{product.name}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} productName={product.name} />

        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {product.purity && <Badge variant="success">{product.purity} purity</Badge>}
            <Badge variant="outline">{FORM_LABELS[product.form] ?? product.form}</Badge>
            {product.researchUse && <Badge variant="outline">RUO</Badge>}
          </div>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {product.name}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">SKU {product.sku}</p>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold">{formatPrice(product.priceCents)}</span>
            {product.compareAtCents != null &&
              product.compareAtCents > product.priceCents && (
                <span className="text-base text-muted-foreground line-through">
                  {formatPrice(product.compareAtCents)}
                </span>
              )}
          </div>

          {/* Add to cart + bulk tier pricing (client: needs cart store) */}
          <div className="mt-6">
            <AddToCartPanel
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                sku: product.sku,
                priceCents: product.priceCents,
                stock: product.stock,
                imageUrl: product.images[0]?.url,
              }}
              tiers={product.priceTiers.map((t) => ({
                minQty: t.minQty,
                unitPriceCents: t.unitPriceCents,
              }))}
            />
          </div>

          <Separator className="my-6" />

          {/* Specs */}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {[
              ["CAS number", product.cas],
              ["Purity (HPLC)", product.purity],
              ["Molar mass", product.molarMass ? `${product.molarMass} g/mol` : null],
              ["Form", FORM_LABELS[product.form] ?? product.form],
              ["Sequence", product.sequence],
            ]
              .filter(([, value]) => Boolean(value))
              .map(([label, value]) => (
                <div key={String(label)} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="break-words text-sm font-medium">{value}</dd>
                </div>
              ))}
          </dl>

          {/* COA download */}
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
                  {product.coas.map((coa) => (
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

          {/* Storage + shipping */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-lg border border-border bg-card p-4">
              <Snowflake className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold">Storage</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {product.storageInfo ??
                    "Store lyophilized at -20°C, protected from light. Once reconstituted, refrigerate at 2–8°C and use within 30 days."}
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-lg border border-border bg-card p-4">
              <Truck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold">Shipping</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Discreet, cold-packed USPS. Orders before 2pm CT ship same business
                  day with tracking synced to your dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <section className="mt-12 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <h2 className="text-lg font-semibold">Description</h2>
          <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </div>

          <div className="mt-6 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertTriangle
              className="h-5 w-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-sm font-semibold text-destructive">
                For Research Use Only
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                This product is sold strictly as a research chemical for in-vitro
                laboratory study by qualified professionals. It is not a drug, food, or
                cosmetic, has not been approved by the FDA for human or veterinary use,
                and must not be administered to humans or animals. Purchaser assumes all
                responsibility for safe handling and lawful use.
              </p>
            </div>
          </div>
        </div>

        {/* Reconstitution calculator */}
        <div>
          <h2 className="text-lg font-semibold">Reconstitution calculator</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Plan your dilution for in-vitro work. Figures are arithmetic only and are not
            dosing guidance.
          </p>
          <div className="mt-3">
            <DosageCalculator productId={product.id} productName={product.name} />
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 text-lg font-semibold">Related compounds</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
