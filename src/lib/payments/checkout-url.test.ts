import { describe, expect, it } from "vitest";

import {
  buildCheckoutMeta,
  mergePaymentProviderRaw,
  paymentCheckoutUrl,
  resolveOrderCheckoutUrl,
} from "./checkout-url";

describe("checkout-url helpers", () => {
  it("reads invoiceUrl from providerRaw", () => {
    expect(paymentCheckoutUrl({ invoiceUrl: "https://pay.example/x" })).toBe(
      "https://pay.example/x"
    );
    expect(paymentCheckoutUrl({ invoiceUrl: "not-a-url" })).toBeNull();
    expect(paymentCheckoutUrl(null)).toBeNull();
  });

  it("preserves invoiceUrl when merging IPN payload", () => {
    const merged = mergePaymentProviderRaw(
      { invoiceUrl: "https://pay.example/keep", invoiceId: "inv_1" },
      { ipn: { payment_status: "finished" } }
    );
    expect(merged.invoiceUrl).toBe("https://pay.example/keep");
    expect(merged.ipn).toEqual({ payment_status: "finished" });
  });

  it("resolves live redirectUrl before stored meta", () => {
    expect(
      resolveOrderCheckoutUrl({
        redirectUrl: "https://pay.example/live",
        payments: [{ providerRaw: { invoiceUrl: "https://pay.example/stored" } }],
      })
    ).toBe("https://pay.example/live");

    expect(
      resolveOrderCheckoutUrl({
        payments: [{ providerRaw: { invoiceUrl: "https://pay.example/stored" } }],
      })
    ).toBe("https://pay.example/stored");
  });

  it("builds checkout meta with invoice fields", () => {
    const meta = buildCheckoutMeta({
      invoiceUrl: "https://pay.example/new",
      invoiceId: "abc",
    });
    expect(meta.invoiceUrl).toBe("https://pay.example/new");
    expect(meta.invoiceId).toBe("abc");
    expect(meta.createdAt).toBeTruthy();
  });
});
