/**
 * First-party cookie / tracking consent helpers.
 * Choice is stored in localStorage; non-essential trackers must gate on `accepted`.
 */

export const COOKIE_CONSENT_KEY = "ebl-cookie-consent";
export const COOKIE_CONSENT_EVENT = "ebl-cookie-consent-change";

export type CookieConsentValue = "accepted" | "rejected";

export function isCookieConsentValue(value: unknown): value is CookieConsentValue {
  return value === "accepted" || value === "rejected";
}

/** Read stored consent. Returns null when the user has not chosen yet. */
export function getCookieConsent(): CookieConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    return isCookieConsentValue(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function hasMarketingConsent(): boolean {
  return getCookieConsent() === "accepted";
}

export function setCookieConsent(value: CookieConsentValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    // ignore quota / private mode
  }
  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_EVENT, { detail: { value } satisfies { value: CookieConsentValue } })
  );
}

/** Clears the choice so the banner can show again (Cookie settings). */
export function clearCookieConsent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(COOKIE_CONSENT_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_EVENT, { detail: { value: null } })
  );
}
