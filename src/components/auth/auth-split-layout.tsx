import Link from "next/link";
import { FlaskConical, ShieldCheck, Beaker, MapPin } from "lucide-react";

const TRUST_ITEMS = [
  { icon: MapPin, label: "Based in USA" },
  { icon: ShieldCheck, label: "Lab tested" },
  { icon: Beaker, label: "≥99% purity" },
];

export function AuthSplitLayout({
  heroTitle,
  heroSubtitle,
  heroCtaHref,
  heroCtaLabel,
  formTitle,
  footerPrompt,
  footerLinkHref,
  footerLinkLabel,
  children,
}: {
  heroTitle: string;
  heroSubtitle: string;
  heroCtaHref: string;
  heroCtaLabel: string;
  formTitle: string;
  footerPrompt: string;
  footerLinkHref: string;
  footerLinkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      {/* Brand panel — no product photography yet; drop a hero image into
          /public/images/auth-hero.jpg and swap the div below for
          <Image src="/images/auth-hero.jpg" fill className="object-cover opacity-40" /> */}
      <div className="relative hidden flex-col justify-center overflow-hidden bg-[#050a14] px-12 py-16 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_20%,hsl(var(--primary)/0.35),transparent_70%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(hsl(var(--primary))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary))_1px,transparent_1px)] [background-size:44px_44px]"
        />

        <div className="relative mx-auto flex max-w-sm flex-col items-center text-center">
          <Link href="/" className="flex items-center gap-2">
            <FlaskConical className="h-8 w-8 text-primary" aria-hidden="true" />
            <span className="text-2xl font-semibold tracking-tight">ElevateBioLab</span>
          </Link>

          <h1 className="mt-10 text-3xl font-bold leading-tight tracking-tight">
            {heroTitle}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/70">{heroSubtitle}</p>

          <Link
            href={heroCtaHref}
            className="tap mt-8 inline-flex items-center justify-center rounded-lg border border-white/25 px-5 text-sm font-medium text-white transition-colors hover:border-primary hover:text-primary"
          >
            {heroCtaLabel}
          </Link>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-4 py-12 sm:px-8 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-2 flex items-center gap-2 lg:hidden">
            <FlaskConical className="h-6 w-6 text-primary" aria-hidden="true" />
            <span className="text-base font-semibold tracking-tight">ElevateBioLab</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">{formTitle}</h2>

          <div className="mt-6">{children}</div>

          <div className="mt-6 flex items-center justify-center gap-4 border-t border-border pt-5">
            {TRUST_ITEMS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
              >
                <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {footerPrompt}{" "}
            <Link href={footerLinkHref} className="font-medium text-primary hover:underline">
              {footerLinkLabel}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuthSplitLayout;
