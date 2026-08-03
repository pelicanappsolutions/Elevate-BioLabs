import { describe, expect, it } from "vitest";

import { orderConfirmationHtml } from "@/lib/email/sendgrid";

const BASE_ORDER = {
  id: "ord_1",
  orderNumber: "EBL-7F3K9Q",
  createdAt: new Date("2026-08-01T15:00:00Z"),
  status: "AWAITING_REVIEW",
  subtotalCents: 35000,
  shippingCents: 0,
  taxCents: 2888,
  totalCents: 37888,
  shipService: "USPS_PRIORITY",
  shipTo: {
    fullName: "Alex Researcher",
    street1: "110 Tall Pines St",
    city: "Belle Chasse",
    state: "LA",
    zip: "70037",
    phone: "5045550199",
  },
  items: [
    {
      name: "Tirzepatide 10mg",
      sku: "TIRZ-10",
      quantity: 1,
      unitPriceCents: 20000,
      totalCents: 20000,
    },
    {
      name: "Retatrutide 15mg",
      sku: "RETA-15",
      quantity: 1,
      unitPriceCents: 15000,
      totalCents: 15000,
    },
  ],
};

describe("orderConfirmationHtml", () => {
  it("includes P2P payment essentials for the customer", () => {
    const html = orderConfirmationHtml({
      ...BASE_ORDER,
      rail: "P2P_ZELLE",
      instructions: {
        method: "Zelle",
        handle: "trosclair.danny@gmail.com",
        memo: "EBL-7F3K9Q",
        note: "Send the exact total and include the memo.",
      },
    });

    expect(html).toContain("EBL-7F3K9Q");
    expect(html).toContain("Action required — send payment");
    expect(html).toContain("Exact amount");
    expect(html).toContain("$378.88");
    expect(html).toContain("trosclair.danny@gmail.com");
    expect(html).toContain("Tirzepatide 10mg");
    expect(html).toContain("SKU TIRZ-10");
    expect(html).toContain("Alex Researcher");
    expect(html).toContain("5045550199");
    expect(html).toContain("USPS PRIORITY");
    expect(html).toContain("View payment instructions");
    expect(html).toContain("For Research Use Only");
    expect(html).toContain("Zelle");
  });

  it("includes hosted payment link for crypto/card rails", () => {
    const html = orderConfirmationHtml({
      ...BASE_ORDER,
      status: "PENDING_PAYMENT",
      rail: "NOWPAYMENTS",
      redirectUrl: "https://nowpayments.io/payment/?iid=abc123",
    });

    expect(html).toContain("Complete payment");
    expect(html).toContain("https://nowpayments.io/payment/?iid=abc123");
    expect(html).toContain("Crypto");
    expect(html).toContain("Payment needed");
    expect(html).toContain("View payment instructions");
    expect(html).toContain("come back later");
  });

  it("falls back to persisted invoiceUrl on payment.providerRaw", () => {
    const html = orderConfirmationHtml({
      ...BASE_ORDER,
      status: "PENDING_PAYMENT",
      rail: "NOWPAYMENTS",
      payments: [
        {
          rail: "NOWPAYMENTS",
          providerRaw: { invoiceUrl: "https://nowpayments.io/payment/?iid=stored99" },
        },
      ],
    });

    expect(html).toContain("https://nowpayments.io/payment/?iid=stored99");
    expect(html).toContain("Complete payment");
  });
});
