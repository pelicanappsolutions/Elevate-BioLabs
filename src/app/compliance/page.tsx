import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, FileCheck2, PackageCheck, RotateCcw, ShieldQuestion, Truck } from "lucide-react";

import { db } from "@/lib/db";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/compliance/contact-form";

export const metadata: Metadata = {
  title: "Compliance & Policies",
  description:
    "FDA Research Use Only labeling, batch/lot tracking, shipping policy, returns, FAQ, and contact for Elevate Bio-Labs.",
};

export const revalidate = 3600;

const SECTIONS = [
  { id: "ruo", label: "Research Use Only" },
  { id: "coa", label: "Verify a COA" },
  { id: "shipping", label: "Shipping policy" },
  { id: "returns", label: "Returns & refunds" },
  { id: "faq", label: "Safety Harbor FAQ" },
  { id: "about", label: "About us" },
  { id: "contact", label: "Contact" },
];

export default async function CompliancePage() {
  // DB-backed policy docs override the built-in copy when an admin publishes one.
  const docs = await db.complianceDoc.findMany({ where: { active: true } });
  const docFor = (category: string) => docs.find((d) => d.category === category);

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
                For Research Use Only — Analytical Standards
              </h2>
              <div className="mt-2 flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
                {docFor("RUO") ? (
                  <p className="whitespace-pre-line">{docFor("RUO")!.body}</p>
                ) : (
                  <>
                    <p>
                      All products sold by Elevate Bio-Labs are analytical chemistry
                      reference standards supplied strictly for in-vitro laboratory research
                      by qualified professionals. They are{" "}
                      <strong className="text-foreground">not</strong> drugs, foods,
                      cosmetics, dietary supplements, or medical devices.
                    </p>
                    <p>
                      No product on this site has been approved by the U.S. Food and Drug
                      Administration for the diagnosis, treatment, cure, or prevention of
                      any disease. Nothing in our product descriptions, marketing, or
                      research tools constitutes medical advice, a dosing recommendation,
                      a reconstitution protocol, or a therapeutic claim.
                    </p>
                    <p>
                      These compounds must not be introduced into humans or animals. Purchase
                      requires that you are 18 years or older, that you operate a laboratory
                      equipped for peptide analysis (HPLC, LC-MS, or equivalent), and that
                      you accept full responsibility for safe handling, storage, and disposal
                      in accordance with all applicable federal, state, and local law.
                    </p>
                    <p>
                      Reselling, relabeling, repackaging, or presenting our products for human
                      or veterinary consumption is a material breach of our terms of sale and
                      will result in immediate account termination and, where warranted,
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
          <h2 className="text-lg font-semibold">Verify a COA</h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every lot is tested by an independent third-party lab using HPLC and mass
          spectrometry. Search by batch number or compound name to pull the report, or
          browse the full certificate archive.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/verify-coa">Verify a batch</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/certificates">Browse certificate archive</Link>
          </Button>
        </div>
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
                  Lyophilized material is packed in plain, unbranded exterior packaging with
                  no product names or claims visible on the outside. Inner packaging is labeled
                  &quot;FOR LABORATORY RESEARCH ONLY — NOT FOR HUMAN CONSUMPTION — ANALYTICAL STANDARD&quot;
                  and includes the printed COA and MSDS sheet.
                </p>
                <p>
                  We do not ship bacteriostatic water, sterile water for injection, syringes,
                  alcohol swabs, or reconstitution guides. We ship within the United States only.
                  Your tracking number syncs automatically to your dashboard and inbox the moment
                  the label is created. Delivery estimates are carrier projections, not guarantees.
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
                  Because these are analytical reference standards whose integrity depends on
                  an unbroken cold chain, we cannot accept returns of opened or
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

      {/* ── Safety Harbor FAQ ── */}
      <section id="faq" className="scroll-mt-28">
        <div className="flex items-center gap-2">
          <ShieldQuestion className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Safety Harbor FAQ</h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Plain-language answers that reinforce the analytical-use-only framework and the
          customer-service firewall.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Faq
            q="Do you sell bacteriostatic water or injection supplies?"
            a="No. We are an analytical chemistry supplier. We do not sell reconstitution liquids, injection equipment, or medical supplies. Our products are intended for analysis by HPLC and mass spectrometry only."
          />
          <Faq
            q="Can I use these for personal health or fitness?"
            a="No. These materials are not intended for human or veterinary consumption, diagnosis, or treatment. They are sold exclusively as laboratory reagents for in-vitro research. Any other use violates our Terms of Service and applicable federal law."
          />
          <Faq
            q="Do you provide instructions on how to use these peptides?"
            a="No. We provide Certificate of Analysis (COA) and Material Safety Data Sheet (MSDS) documentation only. We do not provide experimental protocols, dosing information, or preparation instructions."
          />
          <Faq
            q="What do I need to order?"
            a="An account is required. Institutional emails (.edu / .gov) are verified automatically. All other buyers complete Independent Laboratory verification, including laboratory name, EIN/registration number, laboratory address, intended analytical application, and equipment certification."
          />
          <Faq
            q="Can these ship to a residential address?"
            a="Yes, if the address line includes 'Suite' or 'Lab' (e.g., '123 Main St, Suite 100'). Orders to PO Boxes may be held for manual review. Signature confirmation is required for orders over $500."
          />
          <Faq
            q="Why are some compounds marked Category 3?"
            a="Compounds such as BPC-157, TB-500, and Retatrutide are currently under FDA PCAC evaluation for bulk drug substance status. These SKUs require enhanced verification and an additional affidavit certifying analytical research intent (e.g., chromatographic behavior analysis or stability studies) and no therapeutic use."
          />
        </div>
      </section>

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
              Elevate Bio-Labs supplies analytical reference standards and research reagents
              to laboratories, universities, and independent researchers across the United States.
              We exist because the research supply market has a verification problem: too much
              material ships with no traceable provenance and no independent testing.
            </p>
            <p>
              Our answer is boring and auditable. Every lot is assigned a batch number,
              tested by an independent lab, and published with its full HPLC and mass-spec
              report before a single vial ships. If a batch does not meet spec, it does
              not ship.
            </p>
            <p>
              We operate strictly within the Research Use Only framework. We make no
              therapeutic claims, we give no dosing or reconstitution guidance, we decline to
              answer any question that implies human or veterinary use, and we decline any order
              we believe is destined for therapeutic use.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Our standards</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <li>• ≥99% HPLC purity specification on every catalog compound</li>
              <li>• Independent third-party testing — never in-house-only results</li>
              <li>• Batch/lot traceability from raw material through delivery</li>
              <li>• Plain, unbranded exterior packaging with COA and MSDS inside</li>
              <li>• Age-gated, RUO-labeled storefront with audit-logged operations</li>
              <li>• Dual-track verification (institutional + independent laboratory)</li>
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
          day. We cannot provide guidance on experimental design, sample preparation, dosing,
          or reconstitution.
        </p>
        <div className="mt-4 max-w-xl">
          <ContactForm />
        </div>
      </section>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{q}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>
    </div>
  );
}
