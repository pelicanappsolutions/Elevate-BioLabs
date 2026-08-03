import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COOKIE_CONSENT_KEY,
  clearCookieConsent,
  getCookieConsent,
  hasMarketingConsent,
  isCookieConsentValue,
  setCookieConsent,
} from "./cookie-consent";

describe("cookie consent", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("validates consent values", () => {
    expect(isCookieConsentValue("accepted")).toBe(true);
    expect(isCookieConsentValue("rejected")).toBe(true);
    expect(isCookieConsentValue("maybe")).toBe(false);
  });

  it("stores and reads accept / reject", () => {
    expect(getCookieConsent()).toBeNull();
    expect(hasMarketingConsent()).toBe(false);

    setCookieConsent("accepted");
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe("accepted");
    expect(getCookieConsent()).toBe("accepted");
    expect(hasMarketingConsent()).toBe(true);

    setCookieConsent("rejected");
    expect(getCookieConsent()).toBe("rejected");
    expect(hasMarketingConsent()).toBe(false);
  });

  it("clears consent for settings reset", () => {
    setCookieConsent("accepted");
    clearCookieConsent();
    expect(getCookieConsent()).toBeNull();
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBeNull();
  });
});
