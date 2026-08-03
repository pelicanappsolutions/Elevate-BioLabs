"use client";

import * as React from "react";

import {
  COOKIE_CONSENT_EVENT,
  getCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookie-consent";

/** Live consent state for client components (banner, trackers, settings). */
export function useCookieConsent(): CookieConsentValue | null {
  const [consent, setConsent] = React.useState<CookieConsentValue | null>(null);

  React.useEffect(() => {
    setConsent(getCookieConsent());

    function onChange(event: Event) {
      const detail = (event as CustomEvent<{ value: CookieConsentValue | null }>).detail;
      setConsent(detail?.value ?? getCookieConsent());
    }

    window.addEventListener(COOKIE_CONSENT_EVENT, onChange);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onChange);
  }, []);

  return consent;
}
