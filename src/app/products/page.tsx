import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import type { Prisma, ProductForm } from "@prisma/client";

import { db } from "@/lib/db";
import { ProductCard } from "@/components/product-card";
import { ProductFilters } from "@/components/products/product-filters";
import { SortSelect } from "@/components/products/sort-select";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Analytical Standards Catalog",
  description:
    "Browse third-party tested analytical reference standards — filter by category, purity, form, and price. For Research Use Only.",
};

export const revalidate = 120;

const PAGE_SIZE = 12;

const SORTS = {
  newest: { createdAt: "desc" },
  "price-asc": { minPriceCents: "asc" },
  "price-desc": { minPriceCents: "desc" },
  name: { name: "asc" },
} satisfies Record<string, Prisma.ProductOrderByWithRelationInput>;

type SortKey = keyof typeof SORTS;

interface SearchParams {
  q?: string;
  category?: string;
  form?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  sort?: string;
  page?: string;
}

/** Build the Prisma filter from URL state. URL is the single source of truth,
 *  so filters survive refresh, share, and back-button. */
/** Forms that imply ready-to-use / administration — never list on the storefront. */
const BLOCKED_FORMS: ProductForm[] = ["SOLUTION", "CAPSULE", "NASAL_SPRAY"];

function buildWhere(sp: SearchParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    active: true,
    form: { notIn: BLOCKED_FORMS },
  };

  if (sp.q) {
    where.OR = [
      { name: { contains: sp.q, mode: "insensitive" } },
      { cas: { contains: sp.q, mode: "insensitive" } },
      { description: { contains: sp.q, mode: "insensitive" } },
      { variants: { some: { sku: { contains: sp.q, mode: "insensitive" } } } },
    ];
  }
  if (sp.category) where.category = { slug: sp.category };
  // Ignore blocked form filters even if present in the URL.
  if (sp.form && !BLOCKED_FORMS.includes(sp.form as ProductForm)) {
    where.form = sp.form as ProductForm;
  }
  if (sp.inStock === "1") where.inStock = true;

  // Matches if the compound's cheapest variant falls in range — same "From $X"
  // semantics as the price badge shown on cards.
  const min = sp.minPrice ? Math.round(Number(sp.minPrice) * 100) : undefined;
  const max = sp.maxPrice ? Math.round(Number(sp.maxPrice) * 100) : undefined;
  if (Number.isFinite(min) || Number.isFinite(max)) {
    where.minPriceCents = {
      ...(Number.isFinite(min) ? { gte: min } : {}),
      ...(Number.isFinite(max) ? { lte: max } : {}),
    };
  }
  return where;
}

function buildQuery(sp: SearchParams, overrides: Partial<SearchParams>) {
  const merged = { ...sp, ...overrides };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `/products?${qs}` : "/products";
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const sortKey = (searchParams.sort && searchParams.sort in SORTS
    ? searchParams.sort
    : "newest") as SortKey;

  const where = buildWhere(searchParams);

  const [rawProducts, total, categories] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        variants: {
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { strengthMg: "asc" }],
          take: 1,
          include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
        },
        _count: { select: { variants: { where: { active: true } } } },
      },
      orderBy: SORTS[sortKey],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.product.count({ where }),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const products = rawProducts.map((p) => ({
    ...p,
    images: p.variants[0]?.images ?? [],
    variantCount: p._count.variants,
  }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(
    searchParams.q ||
      searchParams.category ||
      searchParams.form ||
      searchParams.minPrice ||
      searchParams.maxPrice ||
      searchParams.inStock
  );

  return (
    <div className="container-tight py-8 sm:py-12">
      <nav className="mb-4 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>{" "}
        <span className="mx-1">/</span> Shop Standards
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {searchParams.q ? `Results for "${searchParams.q}"` : "Shop Analytical Standards"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {total} product{total === 1 ? "" : "s"} • All compounds supplied For Research
          Use Only
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          ElevateBioLab supplies third-party tested reference standards for qualified
          researchers. Every compound is sold for laboratory use only — not for human or
          veterinary administration.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Filters: collapsible accordion on mobile, sticky rail on desktop */}
        <ProductFilters categories={categories} />

        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground sm:text-sm">
              Showing {products.length ? (page - 1) * PAGE_SIZE + 1 : 0}–
              {(page - 1) * PAGE_SIZE + products.length} of {total}
            </p>
            <SortSelect />
          </div>

          {products.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <SearchX className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-3 text-base font-semibold">No products match</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {hasFilters
                  ? "Try widening your filters or clearing the search."
                  : "The catalog is empty. Run npm run db:seed to load sample products."}
              </p>
              {hasFilters && (
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/products">Clear all filters</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav
              className="mt-8 flex items-center justify-center gap-2"
              aria-label="Pagination"
            >
              <Button
                asChild={page > 1}
                variant="outline"
                size="sm"
                disabled={page <= 1}
                className="tap"
              >
                {page > 1 ? (
                  <Link href={buildQuery(searchParams, { page: String(page - 1) })}>
                    Previous
                  </Link>
                ) : (
                  <span>Previous</span>
                )}
              </Button>

              <span className="px-2 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>

              <Button
                asChild={page < totalPages}
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                className="tap"
              >
                {page < totalPages ? (
                  <Link href={buildQuery(searchParams, { page: String(page + 1) })}>
                    Next
                  </Link>
                ) : (
                  <span>Next</span>
                )}
              </Button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
