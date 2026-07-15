import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FlaskConical, FileCheck2, Truck, Beaker, ChevronRight } from "lucide-react";

import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/product-card";
import { TrustBadges } from "@/components/trust-badges";
import { NewsletterSignup } from "@/components/newsletter-signup";

// Home is the landing + feature page: hero, categories, featured catalog,
// research tools teaser, trust, newsletter. Revalidated so featured/stock
// stay fresh without paying for a DB read on every request.
export const revalidate = 300;

async function getHomeData() {
  const [featured, categories] = await Promise.all([
    db.product.findMany({
      where: { active: true, featured: true },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: { where: { active: true } } } } },
      take: 6,
    }),
  ]);
  return { featured, categories };
}

export default async function HomePage() {
  const { featured, categories } = await getHomeData();

  return (
    <>
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.18),transparent_70%)]"
        />
        <div className="container-tight relative py-14 sm:py-20 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-5 border-primary/40 text-primary">
              <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
              Third-party tested • Batch tracked
            </Badge>

            <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Research peptides you can{" "}
              <span className="text-primary">actually verify</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
              Every vial ships with a downloadable Certificate of Analysis, HPLC purity
              ≥99%, and a traceable batch/lot number. Cold-chain packed, USPS tracked,
              and dispatched same-day on orders placed before 2pm CT.
            </p>

            {/* Mobile-optimized CTA: full-width stacked on phones, inline on desktop */}
            <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="tap w-full sm:w-auto">
                <Link href="/products">
                  Browse catalog
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="tap w-full sm:w-auto">
                <Link href="/compliance#coa">View a sample COA</Link>
              </Button>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              For Research Use Only. Not for human or veterinary consumption. Not
              approved by the FDA for therapeutic use.
            </p>
          </div>
        </div>
      </section>

      {/* ───────────────────── Trust badges ───────────────────── */}
      <section className="border-b border-border bg-card/30">
        <div className="container-tight py-8 sm:py-10">
          <TrustBadges />
        </div>
      </section>

      {/* ───────────────────── Categories ─────────────────────── */}
      {categories.length > 0 && (
        <section className="container-tight py-12 sm:py-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Shop by category
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Curated research compounds grouped by mechanism.
              </p>
            </div>
            <Link
              href="/products"
              className="hidden shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline sm:inline-flex"
            >
              All products
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/products?category=${cat.slug}`}
                className="group relative flex min-h-[104px] flex-col justify-between overflow-hidden rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
              >
                {cat.imageUrl && (
                  <Image
                    src={cat.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 33vw, 50vw"
                    className="object-cover opacity-15 transition-opacity group-hover:opacity-25"
                  />
                )}
                <div className="relative">
                  <h3 className="text-sm font-semibold transition-colors group-hover:text-primary sm:text-base">
                    {cat.name}
                  </h3>
                  {cat.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {cat.description}
                    </p>
                  )}
                </div>
                <span className="relative mt-3 text-xs text-muted-foreground">
                  {cat._count.products} product{cat._count.products === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ───────────────────── Featured ───────────────────────── */}
      <section className="border-y border-border bg-card/30">
        <div className="container-tight py-12 sm:py-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Featured peptides
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Our most requested research compounds, in stock now.
              </p>
            </div>
            <Link
              href="/products"
              className="hidden shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline sm:inline-flex"
            >
              View all
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {featured.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <Beaker className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                No featured products yet. Seed the database with{" "}
                <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                  npm run db:seed
                </code>
                .
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          <div className="mt-8 sm:hidden">
            <Button asChild variant="outline" className="tap w-full">
              <Link href="/products">View all products</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ─────────────── Research tools teaser ────────────────── */}
      <section className="container-tight py-12 sm:py-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Beaker,
              title: "Reconstitution calculator",
              body: "Enter vial strength, diluent volume, and target dose — get the exact draw in units and mL.",
              href: "/products",
              cta: "Try it on any product",
            },
            {
              icon: FileCheck2,
              title: "Batch & COA lookup",
              body: "Every lot has a downloadable third-party HPLC and mass-spec report. Search by batch number.",
              href: "/compliance#coa",
              cta: "Look up a batch",
            },
            {
              icon: Truck,
              title: "Live USPS tracking",
              body: "Tracking numbers sync to your dashboard and inbox automatically the moment a label is cut.",
              href: "/dashboard",
              cta: "Track an order",
            },
          ].map((tool) => (
            <div
              key={tool.title}
              className="flex flex-col rounded-lg border border-border bg-card p-5"
            >
              <tool.icon className="h-6 w-6 text-primary" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold">{tool.title}</h3>
              <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{tool.body}</p>
              <Link
                href={tool.href}
                className="tap mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {tool.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────── Newsletter ─────────────────────── */}
      <section className="border-t border-border bg-card/30">
        <div className="container-tight py-12 sm:py-16">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              New batches, restocks, and research notes
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              One email when something you care about comes back in stock. No spam,
              unsubscribe anytime.
            </p>
            <div className="mt-6">
              <NewsletterSignup source="homepage" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
