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
  variantId: string
): Promise<{ ok: boolean; saved: boolean }> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, saved: false };

  const existing = await db.savedProduct.findUnique({
    where: { userId_variantId: { userId: user.id, variantId } },
  });
  if (existing) {
    await db.savedProduct.delete({ where: { id: existing.id } });
    revalidatePath("/dashboard");
    return { ok: true, saved: false };
  }
  await db.savedProduct.create({ data: { userId: user.id, variantId } });
  revalidatePath("/dashboard");
  return { ok: true, saved: true };
}

const doseSchema = z.object({
  variantId: z.string().optional(),
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
      variantId: parsed.data.variantId || null,
      doseMcg: parsed.data.doseMcg,
      volumeMl: parsed.data.volumeMl,
      note: parsed.data.note,
    },
  });
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateDose(id: string, input: unknown): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Unauthorized" };
  const parsed = doseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid dose entry" };

  // updateMany with the userId filter enforces ownership in one atomic query.
  const r = await db.dosageLog.updateMany({
    where: { id, userId: user.id },
    data: {
      variantId: parsed.data.variantId || null,
      doseMcg: parsed.data.doseMcg,
      volumeMl: parsed.data.volumeMl ?? null,
      note: parsed.data.note ?? null,
    },
  });
  if (r.count === 0) return { ok: false, error: "Entry not found." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteDose(id: string): Promise<{ ok: boolean }> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false };
  await db.dosageLog.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/dashboard");
  return { ok: true };
}

// Account name/email/password/avatar editing moved to src/actions/account.ts
// (shared by customers and admins).

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
    // Scope by userId — never update another customer's address by id alone.
    const updated = await db.address.updateMany({
      where: { id, userId: user.id },
      data: { ...parsed.data, isDefault },
    });
    if (updated.count === 0) {
      return { ok: false, error: "Address not found." };
    }
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
