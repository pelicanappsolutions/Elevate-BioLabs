"use client";

import * as React from "react";
import { Cookie } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useCookieConsent } from "@/hooks/use-cookie-consent";
import { setCookieConsent, type CookieConsentValue } from "@/lib/cookie-consent";
import { cn } from "@/lib/utils";

export function CookieConsent() {
  const consent = useCookieConsent();
  const [bannerOpen, setBannerOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
    setBannerOpen(consent === null);
  }, [consent]);

  function handleChoice(value: CookieConsentValue) {
    setCookieConsent(value);
    setBannerOpen(false);
  }

  if (!hydrated || !bannerOpen) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur",
        "supports-[backdrop-filter]:bg-card/80"
      )}
    >
      <div className="container-tight flex flex-col items-center gap-3 py-4 sm:flex-row sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            We use essential cookies for login and your cart. Optional analytics and marketing
            cookies (for example Klaviyo or Google Analytics, when configured) load only if you
            accept. See our{" "}
            <Link href="/compliance#privacy" className="text-primary underline">
              privacy policy
            </Link>
            .
          </p>
        </div>
        <div className="flex w-full shrink-0 gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => handleChoice("rejected")}
          >
            Reject
          </Button>
          <Button
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => handleChoice("accepted")}
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;
