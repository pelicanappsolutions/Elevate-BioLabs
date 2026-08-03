import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  createChargeMock,
  cancelMock,
  rateLimitMock,
  priceCartMock,
  getShippingRatesMock,
  dbMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  createChargeMock: vi.fn(),
  cancelMock: vi.fn(),
  rateLimitMock: vi.fn(),
  priceCartMock: vi.fn(),
  getShippingRatesMock: vi.fn(),
  dbMock: {
    $transaction: vi.fn(),
    payment: { updateMany: vi.fn() },
    order: { create: vi.fn(), update: vi.fn() },
    user: { update: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));
vi.mock("@/lib/pricing", () => ({ priceCart: priceCartMock }));
vi.mock("@/lib/shipping/index", () => ({ getShippingRates: getShippingRatesMock }));
vi.mock("@/lib/payments/index", () => ({ createCharge: createChargeMock }));
vi.mock("@/lib/payments/available-rails", () => ({
  isCheckoutRailAllowed: () => true,
}));
vi.mock("@/lib/orders/release-reservation", () => ({
  cancelOrderAndReleaseReservation: cancelMock,
}));
vi.mock("@/lib/inventory", () => ({
  decrementStock: vi.fn(),
  InsufficientStockError: class InsufficientStockError extends Error {},
}));
vi.mock("@/lib/email/index", () => ({
  sendTransactional: vi.fn().mockResolvedValue({ ok: true }),
  notifyAdminNewOrder: vi.fn().mockResolvedValue(undefined),
  trackMarketing: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/marketing", () => ({
  recordMarketingOptIn: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  env: { SITE_URL: "http://localhost:3000" },
}));
vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    generateOrderNumber: () => "EBL-TEST01",
  };
});

import { placeOrder } from "@/actions/checkout";

const VARIANT_ID = "cjld2cjxh0000qzrmn831i7rn";

const CHECKOUT_INPUT = {
  email: "buyer@example.com",
  rail: "P2P_ZELLE",
  shipService: "USPS_PRIORITY",
  ageConfirm: true as const,
  address: {
    fullName: "Test Buyer",
    street1: "1 Main St",
    city: "New Orleans",
    state: "LA",
    zip: "70112",
    phone: "5045550100",
  },
  items: [{ variantId: VARIANT_ID, quantity: 1 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "user_1", email: "buyer@example.com" } });
  rateLimitMock.mockResolvedValue({ success: true });
  getShippingRatesMock.mockResolvedValue([
    { service: "USPS_PRIORITY", amountCents: 995, label: "Priority" },
  ]);
  priceCartMock.mockResolvedValue({
    subtotalCents: 10000,
    discountCents: 0,
    shippingCents: 995,
    taxCents: 0,
    totalCents: 10995,
    lines: [
      {
        productId: "prod_1",
        variantId: VARIANT_ID,
        name: "Test Peptide 10mg",
        sku: "TP-10",
        quantity: 1,
        unitPriceCents: 10000,
        totalCents: 10000,
      },
    ],
  });

  const createdOrder = {
    id: "ord_1",
    orderNumber: "EBL-TEST01",
    items: [{ variantId: VARIANT_ID, quantity: 1 }],
    payments: [{ id: "pay_1", rail: "P2P_ZELLE" }],
  };
  dbMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      order: {
        create: vi.fn().mockResolvedValue(createdOrder),
      },
      coupon: {
        findUnique: vi.fn().mockResolvedValue({
          id: "coup_1",
          active: true,
          maxRedemptions: null,
          redemptionCount: 0,
          affiliateName: "Partner Co",
          affiliateEmail: "partner@example.com",
        }),
        update: vi.fn().mockResolvedValue({
          affiliateName: "Partner Co",
          affiliateEmail: "partner@example.com",
        }),
      },
      couponRedemption: {
        create: vi.fn().mockResolvedValue({ id: "red_1" }),
      },
    };
    return fn(tx);
  });
});

describe("placeOrder coupon redemption", () => {
  it("increments coupon usage and writes CouponRedemption with commission", async () => {
    priceCartMock.mockResolvedValue({
      subtotalCents: 10000,
      discountCents: 1000,
      shippingCents: 995,
      taxCents: 0,
      totalCents: 9995,
      couponCode: "PARTNER10",
      couponId: "coup_1",
      commissionCents: 1500,
      lines: [
        {
          productId: "prod_1",
          variantId: VARIANT_ID,
          name: "Test Peptide 10mg",
          sku: "TP-10",
          quantity: 1,
          unitPriceCents: 10000,
          totalCents: 10000,
        },
      ],
    });
    createChargeMock.mockResolvedValue({
      providerRef: "p2p_1",
      instructions: "Send Zelle",
    });
    dbMock.payment.updateMany.mockResolvedValue({ count: 1 });
    dbMock.order.update.mockResolvedValue({});

    let txCouponUpdate: ReturnType<typeof vi.fn> | undefined;
    let txRedemptionCreate: ReturnType<typeof vi.fn> | undefined;
    dbMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        order: {
          create: vi.fn().mockResolvedValue({
            id: "ord_1",
            orderNumber: "EBL-TEST01",
            items: [{ variantId: VARIANT_ID, quantity: 1 }],
            payments: [{ id: "pay_1", rail: "P2P_ZELLE" }],
          }),
        },
        coupon: {
          findUnique: vi.fn().mockResolvedValue({
            id: "coup_1",
            active: true,
            maxRedemptions: 100,
            redemptionCount: 3,
            affiliateName: "Partner Co",
            affiliateEmail: "partner@example.com",
          }),
          update: vi.fn().mockResolvedValue({
            affiliateName: "Partner Co",
            affiliateEmail: "partner@example.com",
          }),
        },
        couponRedemption: {
          create: vi.fn().mockResolvedValue({ id: "red_1" }),
        },
      };
      txCouponUpdate = tx.coupon.update;
      txRedemptionCreate = tx.couponRedemption.create;
      return fn(tx);
    });

    const result = await placeOrder({ ...CHECKOUT_INPUT, couponCode: "PARTNER10" });

    expect(result.ok).toBe(true);
    expect(priceCartMock).toHaveBeenCalledWith(
      CHECKOUT_INPUT.items,
      expect.objectContaining({ couponCode: "PARTNER10" })
    );
    expect(txCouponUpdate).toHaveBeenCalledWith({
      where: { id: "coup_1" },
      data: { redemptionCount: { increment: 1 } },
    });
    expect(txRedemptionCreate).toHaveBeenCalledWith({
      data: {
        couponId: "coup_1",
        orderId: "ord_1",
        userId: "user_1",
        code: "PARTNER10",
        discountCents: 1000,
        orderSubtotalCents: 10000,
        orderTotalCents: 9995,
        commissionCents: 1500,
        affiliateName: "Partner Co",
        affiliateEmail: "partner@example.com",
      },
    });
  });

  it("rejects when the coupon hits its cap inside the order transaction", async () => {
    priceCartMock.mockResolvedValue({
      subtotalCents: 10000,
      discountCents: 1000,
      shippingCents: 995,
      taxCents: 0,
      totalCents: 9995,
      couponCode: "PARTNER10",
      couponId: "coup_1",
      commissionCents: 1500,
      lines: [
        {
          productId: "prod_1",
          variantId: VARIANT_ID,
          name: "Test Peptide 10mg",
          sku: "TP-10",
          quantity: 1,
          unitPriceCents: 10000,
          totalCents: 10000,
        },
      ],
    });
    dbMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        order: { create: vi.fn() },
        coupon: {
          findUnique: vi.fn().mockResolvedValue({
            id: "coup_1",
            active: true,
            maxRedemptions: 5,
            redemptionCount: 5,
          }),
          update: vi.fn(),
        },
        couponRedemption: { create: vi.fn() },
      };
      return fn(tx);
    });

    const result = await placeOrder({ ...CHECKOUT_INPUT, couponCode: "PARTNER10" });
    expect(result).toEqual({
      ok: false,
      error: "That coupon is no longer available.",
    });
    expect(createChargeMock).not.toHaveBeenCalled();
  });
});

describe("placeOrder payment init failure", () => {
  it("cancels the order and releases stock when createCharge throws", async () => {
    createChargeMock.mockRejectedValue(new Error("NOWPayments API down"));
    cancelMock.mockResolvedValue(undefined);

    const result = await placeOrder(CHECKOUT_INPUT);

    expect(result).toEqual({
      ok: false,
      error: "Payment could not be initialized. NOWPayments API down",
    });
    expect(cancelMock).toHaveBeenCalledWith(
      {
        id: "ord_1",
        orderNumber: "EBL-TEST01",
        items: [{ variantId: VARIANT_ID, quantity: 1 }],
      },
      expect.objectContaining({
        auditAction: "PAYMENT_INIT_FAILED",
        auditMeta: expect.objectContaining({ rail: "P2P_ZELLE" }),
      })
    );
  });

  it("still returns a payment error if rollback itself fails", async () => {
    createChargeMock.mockRejectedValue(new Error("gateway timeout"));
    cancelMock.mockRejectedValue(new Error("restock blew up"));

    const result = await placeOrder(CHECKOUT_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("gateway timeout");
    }
  });
});
