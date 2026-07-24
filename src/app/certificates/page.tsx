import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2 } from "lucide-react";

import { db } from "@/lib/db";
import { formatDate, variantDisplayName } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Certificate Archive",
  description:
    "The full archive of Certificates of Analysis for every batch Elevate Bio-Labs has shipped.",
};

export const revalidate = 300;

export default async function CertificatesPage() {
  const coas = await db.cOA.findMany({
    include: { variant: { include: { product: { select: { name: true, slug: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return (
    <div>
      <section className="relative overflow-hidden bg-[#050a14] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_15%_0%,hsl(var(--primary)/0.28),transparent_70%)]"
        />
        <div className="container-tight relative py-16 sm:py-20">
          <nav className="text-xs text-white/50" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">
              Home
            </Link>{" "}
            <span className="mx-1">/</span> Certificates
          </nav>

          <h1 className="mt-6 max-w-xl text-balance text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            Every batch, <span className="text-primary">on the record.</span>
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-white/70 sm:text-base">
            The full archive of Certificates of Analysis for every batch Elevate
            Bio-Labs has shipped. Each entry links to its source report with HPLC purity,
            mass identification, and test date for that lot.
          </p>
        </div>
      </section>

      <section className="container-tight py-10 sm:py-12">
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground sm:text-sm">
            Full archive
          </p>
          <Link
            href="/verify-coa"
            className="text-sm font-medium text-primary hover:underline"
          >
            Search by batch instead →
          </Link>
        </div>

        {coas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <FileCheck2 className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No certificates published yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coas.map((coa) => (
              <a
                key={coa.id}
                href={coa.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Certificate of Analysis
                    </span>
                  </div>
                  {coa.purity && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {coa.purity}
                    </span>
                  )}
                </div>

                <h2 className="mt-3 text-base font-semibold transition-colors group-hover:text-primary">
                  {variantDisplayName(coa.variant.product.name, coa.variant.strengthMg)}
                </h2>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {coa.batchLot}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>{coa.testedOn ? `Tested ${formatDate(coa.testedOn)}` : "—"}</span>
                  <span className="font-medium text-primary group-hover:underline">
                    View report
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
