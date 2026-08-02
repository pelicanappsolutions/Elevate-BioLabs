import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const { authMock, revalidatePathMock, uploadFileMock, dbMock, recordOptInMock, recordOptOutMock } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    uploadFileMock: vi.fn(),
    recordOptInMock: vi.fn(),
    recordOptOutMock: vi.fn(),
    dbMock: {
      user: {
        update: vi.fn(),
        findUnique: vi.fn(),
      },
    },
  }));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/storage", () => ({ uploadFile: uploadFileMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/marketing", () => ({
  recordMarketingOptIn: recordOptInMock,
  recordMarketingOptOut: recordOptOutMock,
}));

import {
  changeEmail,
  changePassword,
  updateAccountName,
  updateAvatar,
  updateMarketingPref,
} from "@/actions/account";
import { Prisma } from "@prisma/client";

const SESSION_USER = { id: "user_1", email: "user@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: SESSION_USER });
});

describe("updateAccountName", () => {
  it("rejects when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await updateAccountName({ name: "New Name" });
    expect(res).toEqual({ ok: false, error: "Unauthorized" });
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("rejects invalid input", async () => {
    const res = await updateAccountName({ name: "a" });
    expect(res.ok).toBe(false);
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("updates the name and revalidates on success", async () => {
    dbMock.user.update.mockResolvedValue({});
    const res = await updateAccountName({ name: "Jane Doe" });
    expect(res).toEqual({ ok: true });
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: SESSION_USER.id },
      data: { name: "Jane Doe" },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin");
  });
});

describe("changeEmail", () => {
  const validInput = { currentPassword: "correct-password", newEmail: "new@example.com" };

  it("rejects when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await changeEmail(validInput);
    expect(res).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("rejects invalid input", async () => {
    const res = await changeEmail({ currentPassword: "x", newEmail: "not-an-email" });
    expect(res.ok).toBe(false);
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects when the account can't be found", async () => {
    dbMock.user.findUnique.mockResolvedValue(null);
    const res = await changeEmail(validInput);
    expect(res).toEqual({ ok: false, error: "Account not found." });
  });

  it("rejects when the account has no password set", async () => {
    dbMock.user.findUnique.mockResolvedValue({ passwordHash: null, email: "user@example.com" });
    const res = await changeEmail(validInput);
    expect(res).toEqual({ ok: false, error: "Set a password before changing your email." });
  });

  it("rejects an incorrect current password", async () => {
    const hash = await bcrypt.hash("actual-password", 10);
    dbMock.user.findUnique.mockResolvedValue({ passwordHash: hash, email: "user@example.com" });
    const res = await changeEmail(validInput);
    expect(res).toEqual({ ok: false, error: "Current password is incorrect." });
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("rejects when the new email matches the current one (case-insensitive)", async () => {
    const hash = await bcrypt.hash("correct-password", 10);
    dbMock.user.findUnique.mockResolvedValue({ passwordHash: hash, email: "New@example.com" });
    const res = await changeEmail(validInput);
    expect(res).toEqual({ ok: false, error: "That's already your email." });
  });

  it("updates the email and clears verification on success", async () => {
    const hash = await bcrypt.hash("correct-password", 10);
    dbMock.user.findUnique.mockResolvedValue({ passwordHash: hash, email: "old@example.com" });
    dbMock.user.update.mockResolvedValue({});
    const res = await changeEmail(validInput);
    expect(res).toEqual({ ok: true });
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: SESSION_USER.id },
      data: { email: "new@example.com", emailVerified: null },
    });
  });

  it("surfaces a friendly error on duplicate email (P2002)", async () => {
    const hash = await bcrypt.hash("correct-password", 10);
    dbMock.user.findUnique.mockResolvedValue({ passwordHash: hash, email: "old@example.com" });
    dbMock.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.22.0",
      })
    );
    const res = await changeEmail(validInput);
    expect(res).toEqual({ ok: false, error: "That email is already in use." });
  });

  it("rethrows unexpected errors", async () => {
    const hash = await bcrypt.hash("correct-password", 10);
    dbMock.user.findUnique.mockResolvedValue({ passwordHash: hash, email: "old@example.com" });
    dbMock.user.update.mockRejectedValue(new Error("connection lost"));
    await expect(changeEmail(validInput)).rejects.toThrow("connection lost");
  });
});

describe("changePassword", () => {
  const validInput = { currentPassword: "old-password", newPassword: "NewPass1", confirmPassword: "NewPass1" };

  it("rejects when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await changePassword(validInput);
    expect(res).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("rejects invalid input (weak password)", async () => {
    const res = await changePassword({ currentPassword: "old-password", newPassword: "weak", confirmPassword: "weak" });
    expect(res.ok).toBe(false);
  });

  it("rejects mismatched confirmation", async () => {
    const res = await changePassword({ currentPassword: "old-password", newPassword: "NewPass1", confirmPassword: "Other1" });
    expect(res.ok).toBe(false);
  });

  it("rejects when the account has no password set", async () => {
    dbMock.user.findUnique.mockResolvedValue({ passwordHash: null });
    const res = await changePassword(validInput);
    expect(res).toEqual({ ok: false, error: "Use the emailed reset link to set a password." });
  });

  it("rejects an incorrect current password", async () => {
    const hash = await bcrypt.hash("something-else", 10);
    dbMock.user.findUnique.mockResolvedValue({ passwordHash: hash });
    const res = await changePassword(validInput);
    expect(res).toEqual({ ok: false, error: "Current password is incorrect." });
  });

  it("hashes and stores the new password on success", async () => {
    const hash = await bcrypt.hash("old-password", 10);
    dbMock.user.findUnique.mockResolvedValue({ passwordHash: hash });
    dbMock.user.update.mockResolvedValue({});
    const res = await changePassword(validInput);
    expect(res).toEqual({ ok: true });
    const call = dbMock.user.update.mock.calls[0]![0];
    expect(call.where).toEqual({ id: SESSION_USER.id });
    expect(await bcrypt.compare("NewPass1", call.data.passwordHash)).toBe(true);
  });
});

describe("updateAvatar", () => {
  function fd(file: unknown) {
    const f = new FormData();
    if (file !== undefined) f.set("avatar", file as never);
    return f;
  }

  it("rejects when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await updateAvatar(fd(new File(["x"], "a.png", { type: "image/png" })));
    expect(res).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("rejects when no file is provided", async () => {
    const res = await updateAvatar(fd(undefined));
    expect(res).toEqual({ ok: false, error: "Choose an image file." });
  });

  it("rejects non-image files", async () => {
    const res = await updateAvatar(fd(new File(["x"], "a.pdf", { type: "application/pdf" })));
    expect(res).toEqual({ ok: false, error: "File must be an image." });
  });

  it("rejects files over 8MB", async () => {
    const big = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    const res = await updateAvatar(fd(big));
    expect(res).toEqual({ ok: false, error: "Image must be under 8MB." });
  });

  it("uploads and saves the avatar url on success", async () => {
    uploadFileMock.mockResolvedValue({ url: "/uploads/avatars/x.png", pathname: "avatars/x.png" });
    dbMock.user.update.mockResolvedValue({});
    const file = new File(["x"], "a.png", { type: "image/png" });
    const res = await updateAvatar(fd(file));
    expect(res).toEqual({ ok: true, url: "/uploads/avatars/x.png" });
    expect(uploadFileMock).toHaveBeenCalledWith(file, "a.png", "avatars");
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: SESSION_USER.id },
      data: { image: "/uploads/avatars/x.png" },
    });
  });
});

describe("updateMarketingPref", () => {
  it("rejects when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await updateMarketingPref({ optIn: true });
    expect(res).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("rejects when the account can't be found", async () => {
    dbMock.user.findUnique.mockResolvedValue(null);
    const res = await updateMarketingPref({ optIn: true });
    expect(res).toEqual({ ok: false, error: "Account not found" });
  });

  it("records an opt-in via the marketing helper", async () => {
    dbMock.user.findUnique.mockResolvedValue({ email: "user@example.com", name: "Jane" });
    const res = await updateMarketingPref({ optIn: true });
    expect(res).toEqual({ ok: true });
    expect(recordOptInMock).toHaveBeenCalledWith({
      email: "user@example.com",
      source: "account",
      name: "Jane",
      userId: SESSION_USER.id,
    });
    expect(recordOptOutMock).not.toHaveBeenCalled();
  });

  it("records an opt-out via the marketing helper", async () => {
    dbMock.user.findUnique.mockResolvedValue({ email: "user@example.com", name: "Jane" });
    const res = await updateMarketingPref({ optIn: false });
    expect(res).toEqual({ ok: true });
    expect(recordOptOutMock).toHaveBeenCalledWith({ email: "user@example.com", userId: SESSION_USER.id });
    expect(recordOptInMock).not.toHaveBeenCalled();
  });
});
