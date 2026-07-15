import Link from "next/link";
import { FlaskConical } from "lucide-react";

import { NewsletterSignup } from "@/components/newsletter-signup";

const SHOP_LINKS = [
  { href: "/products", label: "Catalog" },
  { href: "/products?category=peptides", label: "Peptides" },
  { href: "/products?category=blends", label: "Blends" },
  { href: "/products?category=accessories", label: "Accessories" },
];

const SUPPORT_LINKS = [
  { href: "/contact", label: "Contact" },
  { href: "/compliance#shipping", label: "Shipping Policy" },
  { href: "/compliance#refund", label: "Refund Policy" },
  { href: "/orders/track", label: "Track Order" },
];

const COMPLIANCE_LINKS = [
  { href: "/compliance", label: "RUO Policy" },
  { href: "/compliance#legitscript", label: "LegitScript" },
  { href: "/compliance#coa", label: "COA Lookup" },
  { href: "/compliance#batch", label: "Batch/Lot Tracking" },
];

const PAYMENT_RAILS = ["Card", "ACH", "Crypto", "Zelle"];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card/40">
      <div className="container-tight py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand + disclaimer */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-primary" aria-hidden="true" />
              <span className="text-lg font-semibold tracking-tight">Elevate Bio-Labs</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              All products sold by Elevate Bio-Labs are intended strictly For Research Use
              Only (RUO). They are not for human or veterinary use, diagnostic use, or
              consumption of any kind. Not for sale to minors — you must be 18 or older to
              purchase.
            </p>
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium">Research updates &amp; COA releases</p>
              <NewsletterSignup />
            </div>
          </div>

          <FooterColumn title="Shop" links={SHOP_LINKS} />
          <FooterColumn title="Support" links={SUPPORT_LINKS} />
          <FooterColumn title="Compliance" links={COMPLIANCE_LINKS} />
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>
            &copy; {year} Elevate Bio-Labs. All rights reserved. Must be 18+ to purchase.
          </p>
          <div className="flex items-center gap-3">
            <span className="sr-only">Accepted payment methods:</span>
            {PAYMENT_RAILS.map((rail) => (
              <span
                key={rail}
                className="rounded-md border border-border px-2 py-1 font-medium"
              >
                {rail}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Footer;
