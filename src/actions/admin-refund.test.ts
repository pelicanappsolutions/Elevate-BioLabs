import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, revalidatePathMock, releaseMock, dbMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  releaseMock: vi.fn(),
  dbMock: {
    $transaction: vi.fn(),
    order: { findUnique: vi.fn(), update: vi.fn() },
    payment: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/orders/release-reservation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/orders/release-reservation")>();
  return {
    ...actual,
    releaseOrderStockIfNeeded: releaseMock,
  };
});

import { refundOrder, updateOrderStatus } from "@/actions/admin";

const ADMIN = { id: "admin_1", role: "ADMIN", email: "admin@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: ADMIN });
  releaseMock.mockResolvedValue({ released: true });
  dbMock.$transaction.mockImplementation(async (ops: unknown) => ops);
  dbMock.order.update.mockResolvedValue({
    id: "ord_1",
    orderNumber: "EBL-ABC123",
    status: "CANCELLED",
  });
  dbMock.auditLog.create.mockResolvedValue({});
});

describe("refundOrder", () => {
  it("marks refunded and restores inventory", async () => {
    dbMock.order.findUnique.mockResolvedValue({
      id: "ord_1",
      status: "PAID",
      orderNumber: "EBL-ABC123",
    });

    const res = await refundOrder("ord_1");

    expect(res).toEqual({ ok: true });
    expect(releaseMock).toHaveBeenCalledWith({
      orderId: "ord_1",
      previousStatus: "PAID",
      nextStatus: "REFUNDED",
      reason: "RETURN",
      note: "Admin refund EBL-ABC123",
    });
  });

  it("is a no-op when already refunded", async () => {
    dbMock.order.findUnique.mockResolvedValue({
      id: "ord_1",
      status: "REFUNDED",
      orderNumber: "EBL-ABC123",
    });

    const res = await refundOrder("ord_1");

    expect(res).toEqual({ ok: true });
    expect(releaseMock).not.toHaveBeenCalled();
  });
});

describe("updateOrderStatus cancel", () => {
  it("restores inventory when admin sets CANCELLED", async () => {
    dbMock.order.findUnique.mockResolvedValue({
      id: "ord_1",
      status: "AWAITING_REVIEW",
      orderNumber: "EBL-ABC123",
    });
    dbMock.order.update.mockResolvedValue({
      id: "ord_1",
      orderNumber: "EBL-ABC123",
      status: "CANCELLED",
    });

    const res = await updateOrderStatus({ orderId: "ord_1", status: "CANCELLED" });

    expect(res).toEqual({ ok: true });
    expect(releaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ord_1",
        previousStatus: "AWAITING_REVIEW",
        nextStatus: "CANCELLED",
        reason: "RESERVATION_RELEASE",
      })
    );
  });
});
