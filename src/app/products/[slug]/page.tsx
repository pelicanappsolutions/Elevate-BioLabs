import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileQuestion, Snowflake, Truck } from "lucide-react";

import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/product-card";
import { ProductDetailClient } from "@/components/products/product-detail-client";

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
      category: true,
      variants: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { strengthMg: "asc" }],
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          priceTiers: { orderBy: { minQty: "asc" } },
          coas: { orderBy: { createdAt: "desc" } },
        },
      },
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
      title: `${product.name} | ElevateBioLab`,
      images: product.variants[0]?.images[0] ? [product.variants[0].images[0].url] : [],
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = await getProduct(params.slug);
  if (!product || product.variants.length === 0) notFound();

  const rawRelated = await db.product.findMany({
    where: {
      active: true,
      id: { not: product.id },
      ...(product.categoryId ? { categoryId: product.categoryId } : {}),
    },
    include: {
      variants: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { strengthMg: "asc" }],
        take: 1,
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      },
      _count: { select: { variants: { where: { active: true } } } },
    },
    take: 4,
  });
  const related = rawRelated.map((p) => ({
    ...p,
    images: p.variants[0]?.images ?? [],
    variantCount: p._count.variants,
  }));

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

      <div className="mb-3 flex flex-wrap gap-1.5">
        {product.purity && <Badge variant="success">{product.purity} purity</Badge>}
        <Badge variant="outline">{FORM_LABELS[product.form] ?? product.form}</Badge>
        {product.researchUse && <Badge variant="outline">RUO</Badge>}
        {product.highRisk && (
          <Badge variant="secondary">Enhanced verification</Badge>
        )}
      </div>

      {product.highRisk && (
        <div className="mb-6 flex gap-3 rounded-lg border border-border bg-secondary/40 p-4">
          <FileQuestion className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold">Enhanced verification</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              This SKU requires additional documentation confirming analytical laboratory use
              (e.g., chromatography or mass spectrometry). We may limit order quantities while
              verification is completed.
            </p>
          </div>
        </div>
      )}

      <ProductDetailClient
        productId={product.id}
        productSlug={product.slug}
        productName={product.name}
        variants={product.variants}
      />

      {/* Storage + shipping */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex gap-3 rounded-lg border border-border bg-card p-4">
          <Snowflake className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold">Storage</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {product.storageInfo ??
                "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions."}
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

      {/* Description + specs */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold">Description</h2>
        <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {product.description}
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
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

        <div className="mt-6 flex gap-3 rounded-lg border border-border bg-secondary/40 p-4">
          <div>
            <h3 className="text-sm font-semibold">Research Use Only</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              This product is an analytical reference standard for laboratory research. It is not
              a drug, food, cosmetic, or dietary supplement and has not been evaluated by the FDA for
              human or veterinary use. We do not provide dosing, reconstitution, or sample-preparation
              guidance. Purchaser is responsible for safe handling and lawful use.
            </p>
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
