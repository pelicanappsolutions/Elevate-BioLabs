"use client";

import * as React from "react";
import { Cookie } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ebl-cookie-consent";

export function CookieConsent() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      const consent = window.localStorage.getItem(STORAGE_KEY);
      if (!consent) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function handleChoice(value: "accepted" | "rejected") {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur",
        "supports-[backdrop-filter]:bg-card/80"
      )}
    >
      <div className="container-tight flex flex-col items-center gap-3 py-4 sm:flex-row sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            We use cookies to keep your cart working and improve your experience. See our
            privacy policy for details.
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
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => handleChoice("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;
