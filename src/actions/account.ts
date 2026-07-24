"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import {
  updateNameSchema,
  changeEmailSchema,
  changePasswordSchema,
} from "@/lib/validations";

/**
 * Self-service account management for ANY authenticated user — both customers
 * and admins editing their OWN account. Uses requireUser (session.user.id),
 * never requireAdmin. Name/email/avatar surface in both dashboards' chrome, so
 * every mutation revalidates both.
 */
async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user;
}

function revalidateAccount() {
  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

export async function updateAccountName(
  input: unknown
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Unauthorized" };

  const parsed = updateNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid name" };

  await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  revalidateAccount();
  return { ok: true };
}

export async function changeEmail(
  input: unknown
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Unauthorized" };

  const parsed = changeEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  const { currentPassword, newEmail } = parsed.data;

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, email: true },
  });
  if (!dbUser) return { ok: false, error: "Account not found." };
  if (!dbUser.passwordHash) {
    return { ok: false, error: "Set a password before changing your email." };
  }
  if (!(await bcrypt.compare(currentPassword, dbUser.passwordHash))) {
    return { ok: false, error: "Current password is incorrect." };
  }
  if (newEmail.toLowerCase() === dbUser.email.toLowerCase()) {
    return { ok: false, error: "That's already your email." };
  }

  try {
    // No re-verification flow exists yet, so mark the new address unverified.
    await db.user.update({
      where: { id: user.id },
      data: { email: newEmail, emailVerified: null },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "That email is already in use." };
    }
    throw e;
  }

  revalidateAccount();
  return { ok: true };
}

export async function changePassword(
  input: unknown
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Unauthorized" };

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  const { currentPassword, newPassword } = parsed.data;

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!dbUser?.passwordHash) {
    return { ok: false, error: "Use the emailed reset link to set a password." };
  }
  if (!(await bcrypt.compare(currentPassword, dbUser.passwordHash))) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });
  revalidateAccount();
  return { ok: true };
}

export async function updateAvatar(
  formData: FormData
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Unauthorized" };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image file." };
  if (!file.type.startsWith("image/")) return { ok: false, error: "File must be an image." };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Image must be under 8MB." };

  const uploaded = await uploadFile(file, file.name, "avatars");
  await db.user.update({ where: { id: user.id }, data: { image: uploaded.url } });
  revalidateAccount();
  return { ok: true, url: uploaded.url };
}

export async function updateMarketingPref(input: {
  optIn: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Unauthorized" };

  await db.user.update({
    where: { id: user.id },
    data: { marketingOptIn: Boolean(input.optIn) },
  });
  revalidateAccount();
  return { ok: true };
}
