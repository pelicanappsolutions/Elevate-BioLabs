import type { Metadata } from "next";
import Link from "next/link";

import { BatchLookup } from "@/components/compliance/batch-lookup";

export const metadata: Metadata = {
  title: "Verify a COA",
  description:
    "Search by batch/lot number or compound name to retrieve the third-party Certificate of Analysis for your vial.",
};

const SUGGESTIONS = ["BPC-157", "NAD+", "KLOW Blend"];

export default function VerifyCoaPage() {
  return (
    <div>
      {/* Dark hero — mirrors the compliance section this replaces, standalone
          so the lookup tool reads as its own destination, not a buried anchor. */}
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
            <span className="mx-1">/</span> Verify COA
          </nav>

          <h1 className="mt-6 max-w-xl text-balance text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            Every batch on the record.{" "}
            <span className="text-primary">Verify yours.</span>
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-white/70 sm:text-base">
            Search by compound name or batch/lot number to retrieve the latest
            Certificate of Analysis — HPLC purity, mass identification, and test date for
            that batch.
          </p>

          <div className="mt-8 max-w-md rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur">
            <BatchLookup suggestions={SUGGESTIONS} />
          </div>
        </div>
      </section>

      <section className="container-tight py-10 sm:py-12">
        <p className="text-sm text-muted-foreground">
          Looking for the full archive instead?{" "}
          <Link href="/certificates" className="font-medium text-primary hover:underline">
            Browse every published certificate
          </Link>
          . Can&apos;t find your batch?{" "}
          <Link href="/compliance#contact" className="font-medium text-primary hover:underline">
            Contact us
          </Link>{" "}
          and we&apos;ll pull the report manually.
        </p>
      </section>
    </div>
  );
}
