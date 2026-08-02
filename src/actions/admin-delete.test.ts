import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, dbMock, recomputeMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  recomputeMock: vi.fn(),
  dbMock: {
    orderItem: { count: vi.fn() },
    product: { update: vi.fn(), delete: vi.fn() },
    productVariant: { update: vi.fn(), delete: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
  },
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/inventory", () => ({
  adjustStock: vi.fn(),
  recomputeProductAggregates: recomputeMock,
}));
vi.mock("@/lib/storage", () => ({ uploadFile: vi.fn(), deleteFile: vi.fn() }));
vi.mock("@/lib/shipping/usps", () => ({ createLabel: vi.fn() }));
vi.mock("@/lib/shipping/shippo", () => ({ createShippoLabel: vi.fn() }));
vi.mock("@/lib/email/index", () => ({ sendMarketingEmail: vi.fn(), sendTransactional: vi.fn() }));
vi.mock("@/lib/marketing", () => ({ listMarketingEmails: vi.fn() }));
vi.mock("@/lib/payments/p2p-confirm", () => ({ confirmP2pPaymentByOrder: vi.fn() }));

import { deleteProduct, deleteVariant } from "@/actions/admin";

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "admin_1", role: "ADMIN" } });
  dbMock.auditLog.create.mockResolvedValue({});
  dbMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({}));
});

describe("deleteProduct", () => {
  it("refuses non-admins", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "CUSTOMER" } });
    const res = await deleteProduct("prod_1");
    expect(res).toEqual({ ok: false });
    expect(dbMock.product.delete).not.toHaveBeenCalled();
    expect(dbMock.product.update).not.toHaveBeenCalled();
  });

  it("hard-deletes a compound that was never ordered so it leaves the list", async () => {
    dbMock.orderItem.count.mockResolvedValue(0);
    dbMock.product.delete.mockResolvedValue({ id: "prod_1" });

    const res = await deleteProduct("prod_1");

    expect(res).toEqual({ ok: true, outcome: "removed" });
    expect(dbMock.product.delete).toHaveBeenCalledWith({ where: { id: "prod_1" } });
    expect(dbMock.product.update).not.toHaveBeenCalled();
  });

  it("falls back to deactivating a compound that has order history", async () => {
    dbMock.orderItem.count.mockResolvedValue(3);
    dbMock.product.update.mockResolvedValue({ id: "prod_1" });

    const res = await deleteProduct("prod_1");

    expect(res).toEqual({ ok: true, outcome: "deactivated" });
    expect(dbMock.product.update).toHaveBeenCalledWith({
      where: { id: "prod_1" },
      data: { active: false },
    });
    expect(dbMock.product.delete).not.toHaveBeenCalled();
  });
});

describe("deleteVariant", () => {
  it("refuses non-admins", async () => {
    authMock.mockResolvedValue(null);
    const res = await deleteVariant("var_1");
    expect(res).toEqual({ ok: false });
  });

  it("hard-deletes an unordered strength and recomputes parent aggregates", async () => {
    dbMock.orderItem.count.mockResolvedValue(0);
    dbMock.productVariant.delete.mockResolvedValue({ id: "var_1", productId: "prod_1" });

    const res = await deleteVariant("var_1");

    expect(res).toEqual({ ok: true, outcome: "removed" });
    expect(dbMock.productVariant.delete).toHaveBeenCalledWith({ where: { id: "var_1" } });
    expect(recomputeMock).toHaveBeenCalledWith(expect.anything(), "prod_1");
  });

  it("deactivates a strength that has order history and still recomputes aggregates", async () => {
    dbMock.orderItem.count.mockResolvedValue(1);
    dbMock.productVariant.update.mockResolvedValue({ id: "var_1", productId: "prod_1" });

    const res = await deleteVariant("var_1");

    expect(res).toEqual({ ok: true, outcome: "deactivated" });
    expect(dbMock.productVariant.update).toHaveBeenCalledWith({
      where: { id: "var_1" },
      data: { active: false },
    });
    expect(dbMock.productVariant.delete).not.toHaveBeenCalled();
    expect(recomputeMock).toHaveBeenCalledWith(expect.anything(), "prod_1");
  });
});
