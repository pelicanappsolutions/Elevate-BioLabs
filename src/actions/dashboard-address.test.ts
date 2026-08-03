import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, revalidatePathMock, dbMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  dbMock: {
    address: {
      updateMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { saveAddress } from "@/actions/dashboard";

const OWNER = { id: "user_owner", email: "owner@example.com" };
const ADDRESS_ID = "cjld2cjxh0000qzrmn831i7rn";

const VALID_ADDRESS = {
  fullName: "Alex Researcher",
  street1: "110 Tall Pines St",
  city: "Belle Chasse",
  state: "LA",
  zip: "70037",
  phone: "5045550199",
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: OWNER });
  dbMock.address.updateMany.mockResolvedValue({ count: 1 });
  dbMock.address.create.mockResolvedValue({ id: ADDRESS_ID });
});

describe("saveAddress", () => {
  it("rejects unauthenticated callers", async () => {
    authMock.mockResolvedValue(null);
    const res = await saveAddress(VALID_ADDRESS);
    expect(res).toEqual({ ok: false, error: "Unauthorized" });
    expect(dbMock.address.create).not.toHaveBeenCalled();
  });

  it("scopes updates to the signed-in user's addresses", async () => {
    const res = await saveAddress({ ...VALID_ADDRESS, id: ADDRESS_ID });

    expect(res).toEqual({ ok: true });
    expect(dbMock.address.updateMany).toHaveBeenCalledWith({
      where: { id: ADDRESS_ID, userId: OWNER.id },
      data: expect.objectContaining({
        fullName: "Alex Researcher",
        street1: "110 Tall Pines St",
      }),
    });
  });

  it("returns not found when the address belongs to someone else", async () => {
    dbMock.address.updateMany.mockResolvedValue({ count: 0 });

    const res = await saveAddress({ ...VALID_ADDRESS, id: ADDRESS_ID });

    expect(res).toEqual({ ok: false, error: "Address not found." });
    expect(dbMock.address.create).not.toHaveBeenCalled();
  });

  it("creates a new address for the current user when no id is provided", async () => {
    const res = await saveAddress(VALID_ADDRESS);

    expect(res).toEqual({ ok: true });
    expect(dbMock.address.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: OWNER.id,
        fullName: "Alex Researcher",
      }),
    });
  });
});
