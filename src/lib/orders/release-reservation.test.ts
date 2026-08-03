import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, adjustStockMock } = vi.hoisted(() => ({
  adjustStockMock: vi.fn(),
  dbMock: {
    $transaction: vi.fn(),
    payment: { update: vi.fn(), updateMany: vi.fn() },
    order: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/inventory", () => ({ adjustStock: adjustStockMock }));

import { cancelOrderAndReleaseReservation } from "@/lib/orders/release-reservation";

const ORDER = {
  id: "ord_1",
  orderNumber: "EBL-ABC123",
  items: [
    { variantId: "var_a", quantity: 2 },
    { variantId: "var_b", quantity: 1 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.$transaction.mockImplementation(async (fn: (tx: typeof dbMock) => Promise<void>) => {
    await fn(dbMock);
  });
  adjustStockMock.mockResolvedValue(10);
});

describe("cancelOrderAndReleaseReservation", () => {
  it("marks payment FAILED, order CANCELLED, and restocks every line", async () => {
    await cancelOrderAndReleaseReservation(ORDER, {
      note: "Payment init failed EBL-ABC123: gateway down",
      auditAction: "PAYMENT_INIT_FAILED",
      auditMeta: { rail: "NOWPAYMENTS" },
    });

    expect(dbMock.payment.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: "ord_1",
        status: { notIn: ["SUCCEEDED", "REFUNDED", "FAILED"] },
      },
      data: { status: "FAILED" },
    });
    expect(dbMock.order.update).toHaveBeenCalledWith({
      where: { id: "ord_1" },
      data: { status: "CANCELLED" },
    });
    expect(dbMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "PAYMENT_INIT_FAILED",
        entityId: "ord_1",
      }),
    });
    expect(adjustStockMock).toHaveBeenCalledTimes(2);
    expect(adjustStockMock).toHaveBeenCalledWith(
      "var_a",
      2,
      "RESERVATION_RELEASE",
      "Payment init failed EBL-ABC123: gateway down"
    );
    expect(adjustStockMock).toHaveBeenCalledWith(
      "var_b",
      1,
      "RESERVATION_RELEASE",
      "Payment init failed EBL-ABC123: gateway down"
    );
  });

  it("updates a specific payment row when paymentId is provided (webhook path)", async () => {
    await cancelOrderAndReleaseReservation(ORDER, {
      note: "Failed payment EBL-ABC123",
      paymentId: "pay_1",
      providerRaw: { type: "payment.failed" },
    });

    expect(dbMock.payment.update).toHaveBeenCalledWith({
      where: { id: "pay_1" },
      data: {
        status: "FAILED",
        providerRaw: { type: "payment.failed" },
      },
    });
    expect(dbMock.payment.updateMany).not.toHaveBeenCalled();
  });

  it("throws when inventory release fails after cancel", async () => {
    adjustStockMock
      .mockResolvedValueOnce(8)
      .mockRejectedValueOnce(new Error("version conflict"));

    await expect(
      cancelOrderAndReleaseReservation(ORDER, { note: "fail" })
    ).rejects.toThrow(/inventory release failed/);
  });
});
