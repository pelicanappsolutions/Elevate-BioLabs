import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, FileCheck2, PackageCheck, RotateCcw, Truck } from "lucide-react";

import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ContactForm } from "@/components/compliance/contact-form";
import { BatchLookup } from "@/components/compliance/batch-lookup";

export const metadata: Metadata = {
  title: "Compliance & Policies",
  description:
    "FDA Research Use Only labeling, batch/lot tracking, shipping policy, returns, and contact for Elevate Bio-Labs.",
};

export const revalidate = 3600;

const SECTIONS = [
  { id: "ruo", label: "Research Use Only" },
  { id: "coa", label: "Batch & COA lookup" },
  { id: "shipping", label: "Shipping policy" },
  { id: "returns", label: "Returns & refunds" },
  { id: "about", label: "About us" },
  { id: "contact", label: "Contact" },
];

export default async function CompliancePage() {
  // DB-backed policy docs override the built-in copy when an admin publishes one.
  const docs = await db.complianceDoc.findMany({ where: { active: true } });
  const docFor = (category: string) => docs.find((d) => d.category === category);

  const recentCoas = await db.cOA.findMany({
    include: { product: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  return (
    <div className="container-tight py-8 sm:py-12">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Compliance & policies
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          How we label, test, track, and ship every compound — and the boundaries we
          operate within.
        </p>
      </header>

      {/* Jump nav */}
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Sections">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="tap inline-flex items-center rounded-full border border-border px-3 text-xs font-medium transition-colors hover:border-primary/50 hover:text-primary"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {/* ── RUO ── */}
      <section id="ruo" className="mt-10 scroll-mt-28">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex gap-3">
            <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
            <div>
              <h2 className="text-lg font-semibold text-destructive">
                For Research Use Only
              </h2>
              <div className="mt-2 flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
                {docFor("RUO") ? (
                  <p className="whitespace-pre-line">{docFor("RUO")!.body}</p>
                ) : (
                  <>
                    <p>
                      All products sold by Elevate Bio-Labs are research chemicals
                      supplied strictly for in-vitro laboratory research and analytical
                      reference by qualified professionals. They are{" "}
                      <strong className="text-foreground">not</strong> drugs, foods,
                      cosmetics, dietary supplements, or medical devices.
                    </p>
                    <p>
                      No product on this site has been approved by the U.S. Food and Drug
                      Administration for the diagnosis, treatment, cure, or prevention of
                      any disease. Nothing in our product descriptions, marketing, or
                      research tools constitutes medical advice, a dosing recommendation,
                      or a therapeutic claim.
                    </p>
                    <p>
                      These compounds must not be administered to humans or animals.
                      Purchase requires that you are 18 years or older, that you are
                      acquiring the material for lawful research purposes, and that you
                      accept full responsibility for safe handling, storage, and disposal
                      in accordance with all applicable federal, state, and local law.
                    </p>
                    <p>
                      Reselling, relabeling, or repackaging our products for human
                      consumption is a material breach of our terms of sale and will
                      result in immediate account termination and, where warranted,
                      referral to the relevant authorities.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COA / batch ── */}
      <section id="coa" className="mt-10 scroll-mt-28">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Batch & COA lookup</h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every lot is tested by an independent third-party lab using HPLC and mass
          spectrometry. Enter a batch number from your vial label to pull its report.
        </p>

        <div className="mt-4">
          <BatchLookup />
        </div>

        {recentCoas.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold">Recently published COAs</h3>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Batch / lot</th>
                    <th className="px-3 py-2 font-medium">Compound</th>
                    <th className="px-3 py-2 font-medium">Purity</th>
                    <th className="px-3 py-2 font-medium">Tested</th>
                    <th className="px-3 py-2 font-medium">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCoas.map((coa) => (
                    <tr key={coa.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{coa.batchLot}</td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/products/${coa.product.slug}`}
                          className="font-medium hover:text-primary"
                        >
                          {coa.product.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {coa.purity ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {coa.testedOn ? formatDate(coa.testedOn) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={coa.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Download PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <Separator className="my-10" />

      {/* ── Shipping + returns ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section id="shipping" className="scroll-mt-28">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Shipping policy</h2>
          </div>
          <div className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
            {docFor("SHIPPING_POLICY") ? (
              <p className="whitespace-pre-line">{docFor("SHIPPING_POLICY")!.body}</p>
            ) : (
              <>
                <p>
                  Orders confirmed before 2:00pm CT on a business day ship the same day.
                  We ship via USPS with tracking on every parcel; rates are quoted live
                  at checkout from your ZIP code and order weight.
                </p>
                <p>
                  Lyophilized material is packed discreetly with a cold pack and
                  insulating liner. Packaging carries no product names or claims on the
                  exterior.
                </p>
                <p>
                  We ship within the United States only. Your tracking number syncs
                  automatically to your dashboard and inbox the moment the label is
                  created. Delivery estimates are carrier projections, not guarantees.
                </p>
              </>
            )}
          </div>
        </section>

        <section id="returns" className="scroll-mt-28">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Returns & refunds</h2>
          </div>
          <div className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
            {docFor("REFUND") ? (
              <p className="whitespace-pre-line">{docFor("REFUND")!.body}</p>
            ) : (
              <>
                <p>
                  Because these are research chemicals whose integrity depends on an
                  unbroken cold chain, we cannot accept returns of opened or
                  temperature-exposed vials.
                </p>
                <p>
                  If a shipment arrives damaged, incorrect, or fails to match its COA,
                  contact us within 7 days of delivery with photographs and your order
                  number. Verified claims are replaced or refunded in full, including
                  shipping.
                </p>
                <p>
                  Unopened, undamaged orders may be returned within 14 days for a refund
                  less shipping. Disputes are far faster to resolve with us directly than
                  through a chargeback — please write to us first.
                </p>
              </>
            )}
          </div>
        </section>
      </div>

      <Separator className="my-10" />

      {/* ── About ── */}
      <section id="about" className="scroll-mt-28">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">About Elevate Bio-Labs</h2>
        </div>
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              Elevate Bio-Labs supplies research peptides to laboratories, universities,
              and independent researchers across the United States. We exist because the
              research supply market has a verification problem: too much material ships
              with no traceable provenance and no independent testing.
            </p>
            <p>
              Our answer is boring and auditable. Every lot is assigned a batch number,
              tested by an independent lab, and published with its full HPLC and mass-spec
              report before a single vial ships. If a batch does not meet spec, it does
              not ship.
            </p>
            <p>
              We operate strictly within the Research Use Only framework. We make no
              therapeutic claims, we give no dosing guidance, and we decline any order we
              believe is destined for human use.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Our standards</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <li>• ≥99% HPLC purity specification on every catalog compound</li>
              <li>• Independent third-party testing — never in-house-only results</li>
              <li>• Batch/lot traceability from raw material through delivery</li>
              <li>• Cold-chain packing with discreet, unbranded exteriors</li>
              <li>• Age-gated, RUO-labeled storefront with audit-logged operations</li>
              <li>• LegitScript-aligned documentation and chargeback monitoring</li>
            </ul>
          </div>
        </div>
      </section>

      <Separator className="my-10" />

      {/* ── Contact ── */}
      <section id="contact" className="scroll-mt-28">
        <h2 className="text-lg font-semibold">Contact us</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Questions about a batch, an order, or a bulk quote? We reply within one business
          day.
        </p>
        <div className="mt-4 max-w-xl">
          <ContactForm />
        </div>
      </section>
    </div>
  );
}
