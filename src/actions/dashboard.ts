"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { addressSchema } from "@/lib/validations";
import { z } from "zod";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user;
}

export async function toggleSavedProduct(
  productId: string
): Promise<{ ok: boolean; saved: boolean }> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, saved: false };

  const existing = await db.savedProduct.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
  });
  if (existing) {
    await db.savedProduct.delete({ where: { id: existing.id } });
    revalidatePath("/dashboard");
    return { ok: true, saved: false };
  }
  await db.savedProduct.create({ data: { userId: user.id, productId } });
  revalidatePath("/dashboard");
  return { ok: true, saved: true };
}

const doseSchema = z.object({
  productId: z.string().optional(),
  doseMcg: z.coerce.number().positive(),
  volumeMl: z.coerce.number().positive().optional(),
  note: z.string().max(500).optional(),
});

export async function logDose(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Unauthorized" };
  const parsed = doseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid dose entry" };

  await db.dosageLog.create({
    data: {
      userId: user.id,
      productId: parsed.data.productId || null,
      doseMcg: parsed.data.doseMcg,
      volumeMl: parsed.data.volumeMl,
      note: parsed.data.note,
    },
  });
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateProfile(input: {
  name?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Unauthorized" };
  const name = z.string().min(2).max(80).optional().safeParse(input.name);
  if (!name.success) return { ok: false, error: "Invalid name" };
  await db.user.update({ where: { id: user.id }, data: { name: input.name } });
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function saveAddress(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Unauthorized" };

  const id = (input as { id?: string }).id;
  const isDefault = Boolean((input as { isDefault?: boolean }).isDefault);
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid address" };

  if (isDefault) {
    await db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  }

  if (id) {
    await db.address.update({ where: { id }, data: { ...parsed.data, isDefault } });
  } else {
    await db.address.create({ data: { ...parsed.data, userId: user.id, isDefault } });
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteAddress(id: string): Promise<{ ok: boolean }> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false };
  await db.address.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/dashboard");
  return { ok: true };
}
