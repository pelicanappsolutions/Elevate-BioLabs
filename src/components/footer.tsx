import Link from "next/link";
import { FlaskConical } from "lucide-react";

import { NewsletterSignup } from "@/components/newsletter-signup";

const CATEGORY_LINKS = [
  { href: "/products?category=metabolic", label: "Metabolic" },
  { href: "/products?category=recovery-repair", label: "Recovery & Repair" },
  { href: "/products?category=growth-hormone", label: "Growth Hormone" },
  { href: "/products?category=cognitive", label: "Cognitive" },
  { href: "/products?category=blends", label: "Blends" },
  { href: "/products?category=longevity", label: "Longevity" },
];

const SHOP_LINKS = [
  { href: "/products/bpc-157-5mg", label: "BPC-157" },
  { href: "/products/semaglutide-5mg", label: "Semaglutide" },
  { href: "/products/tirzepatide-10mg", label: "Tirzepatide" },
  { href: "/products/retatrutide-10mg", label: "Retatrutide" },
  { href: "/products/klow-blend-80mg", label: "KLOW Blend" },
  { href: "/products", label: "Shop all peptides →" },
];

const SUPPORT_LINKS = [
  { href: "/dashboard", label: "Order Tracking" },
  { href: "/certificates", label: "COA Library" },
  { href: "/verify-coa", label: "Verify a COA" },
  { href: "/compliance#shipping", label: "Shipping & Returns" },
  { href: "/compliance#contact", label: "Contact Support" },
  { href: "/compliance#about", label: "About Us" },
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

            <div className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Shipping:</span>
              <span>
                USPS tracked, ships same day on orders placed before 2pm CT. Domestic (US)
                delivery only.
              </span>
            </div>
          </div>

          <FooterColumn title="Browse Categories" links={CATEGORY_LINKS} />
          <FooterColumn title="Shop Peptides" links={SHOP_LINKS} />
          <FooterColumn title="Resources & Support" links={SUPPORT_LINKS} />
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
