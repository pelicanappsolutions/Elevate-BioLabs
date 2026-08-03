"use client";

import * as React from "react";

import { useCookieConsent } from "@/hooks/use-cookie-consent";

const KLAVIYO_SCRIPT_ID = "ebl-klaviyo-onsite";
const GA_SCRIPT_ID = "ebl-ga-gtag";
const GA_INLINE_ID = "ebl-ga-inline";

type Props = {
  /** Klaviyo company / public site ID (safe to expose). */
  klaviyoPublicKey?: string;
  /** Optional Google Analytics 4 measurement ID (G-XXXX). */
  gaMeasurementId?: string;
};

function removeElementById(id: string) {
  document.getElementById(id)?.remove();
}

function unloadMarketingScripts() {
  removeElementById(KLAVIYO_SCRIPT_ID);
  removeElementById(GA_SCRIPT_ID);
  removeElementById(GA_INLINE_ID);
  const w = window as Window & {
    klaviyo?: unknown;
    _klOnsite?: unknown;
    dataLayer?: unknown;
    gtag?: unknown;
  };
  try {
    delete w.klaviyo;
    delete w._klOnsite;
  } catch {
    w.klaviyo = undefined;
    w._klOnsite = undefined;
  }
}

function loadKlaviyo(companyId: string) {
  if (document.getElementById(KLAVIYO_SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = KLAVIYO_SCRIPT_ID;
  script.async = true;
  script.src = `https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=${encodeURIComponent(companyId)}`;
  document.head.appendChild(script);
}

function loadGoogleAnalytics(measurementId: string) {
  if (document.getElementById(GA_SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  const inline = document.createElement("script");
  inline.id = GA_INLINE_ID;
  inline.text = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied' });
    gtag('config', ${JSON.stringify(measurementId)}, { anonymize_ip: true });
  `;
  document.head.appendChild(inline);
}

/**
 * Loads optional third-party marketing / analytics scripts only after
 * cookie consent === accepted. Reject (or no choice) keeps them off.
 * Auth session cookies and cart localStorage are unaffected.
 */
export function ConsentGatedTracking({ klaviyoPublicKey = "", gaMeasurementId = "" }: Props) {
  const consent = useCookieConsent();
  const klaviyoId = klaviyoPublicKey.trim();
  const gaId = gaMeasurementId.trim();

  React.useEffect(() => {
    if (consent !== "accepted") {
      unloadMarketingScripts();
      return;
    }

    if (klaviyoId) loadKlaviyo(klaviyoId);
    if (gaId) loadGoogleAnalytics(gaId);
  }, [consent, klaviyoId, gaId]);

  return null;
}

export default ConsentGatedTracking;
