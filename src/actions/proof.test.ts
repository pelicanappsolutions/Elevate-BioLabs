import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, uploadFileMock, dbMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  uploadFileMock: vi.fn(),
  dbMock: {
    order: { findUnique: vi.fn(), update: vi.fn() },
    paymentReceipt: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/storage", () => ({ uploadFile: uploadFileMock }));

import { uploadProofOfPayment } from "@/actions/proof";

const ORDER_ID = "cjld2cjxh0000qzrmn831i7rn";
const OWNER = { id: "user_owner", email: "owner@example.com" };

function makeFormData(overrides: Record<string, string | File> = {}) {
  const fd = new FormData();
  fd.set("orderId", ORDER_ID);
  fd.set("rail", "P2P_ZELLE");
  fd.set("amountCents", "10995");
  fd.set("file", new File(["receipt-bytes"], "zelle.png", { type: "image/png" }));
  for (const [k, v] of Object.entries(overrides)) {
    fd.set(k, v);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: OWNER });
  dbMock.order.findUnique.mockResolvedValue({ id: ORDER_ID, userId: OWNER.id });
  uploadFileMock.mockResolvedValue({ url: "https://blob.example/receipts/zelle.png" });
  dbMock.$transaction.mockResolvedValue([]);
});

describe("uploadProofOfPayment", () => {
  it("rejects unauthenticated callers before touching storage", async () => {
    authMock.mockResolvedValue(null);

    const res = await uploadProofOfPayment(makeFormData());

    expect(res).toEqual({
      ok: false,
      error: "Please sign in to upload payment proof.",
    });
    expect(dbMock.order.findUnique).not.toHaveBeenCalled();
    expect(uploadFileMock).not.toHaveBeenCalled();
  });

  it("rejects uploads for orders owned by someone else", async () => {
    dbMock.order.findUnique.mockResolvedValue({
      id: ORDER_ID,
      userId: "user_other",
    });

    const res = await uploadProofOfPayment(makeFormData());

    expect(res).toEqual({ ok: false, error: "Order not found." });
    expect(uploadFileMock).not.toHaveBeenCalled();
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("accepts proof from the order owner", async () => {
    const res = await uploadProofOfPayment(makeFormData());

    expect(res).toEqual({ ok: true });
    expect(uploadFileMock).toHaveBeenCalled();
    expect(dbMock.$transaction).toHaveBeenCalled();
  });
});
