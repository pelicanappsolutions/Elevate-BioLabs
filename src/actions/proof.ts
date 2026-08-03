"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import { proofOfPaymentSchema } from "@/lib/validations";
import type { PaymentRail } from "@prisma/client";

/**
 * P2P proof-of-payment upload. Customer submits a screenshot/PDF of their
 * Zelle/Venmo/wire transfer; it lands in the admin verification queue
 * (PaymentReceipt.approved = false) and the order sits in AWAITING_REVIEW.
 *
 * Requires a signed-in owner of the order — orderId alone must not be enough.
 */
export async function uploadProofOfPayment(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Please sign in to upload payment proof." };
  }

  const orderId = String(formData.get("orderId") ?? "");
  const rail = String(formData.get("rail") ?? "");
  const reference = formData.get("reference") ? String(formData.get("reference")) : undefined;
  const amountRaw = formData.get("amountCents");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please attach your payment screenshot or receipt." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "File too large (max 8MB)." };
  }

  const parsed = proofOfPaymentSchema.safeParse({
    orderId,
    rail,
    fileUrl: "https://placeholder.local/pending", // replaced after upload
    reference,
    amountCents: amountRaw ? Number(amountRaw) : undefined,
  });
  if (!parsed.success) return { ok: false, error: "Invalid submission." };

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true },
  });
  if (!order) return { ok: false, error: "Order not found." };

  // Ownership: never accept proof against another customer's order.
  if (order.userId !== session.user.id) {
    return { ok: false, error: "Order not found." };
  }

  const uploaded = await uploadFile(file, file.name, "receipts");

  await db.$transaction([
    db.paymentReceipt.create({
      data: {
        orderId,
        rail: rail as PaymentRail,
        fileUrl: uploaded.url,
        reference,
        amountCents: parsed.data.amountCents,
        approved: false,
      },
    }),
    db.order.update({ where: { id: orderId }, data: { status: "AWAITING_REVIEW" } }),
    db.auditLog.create({
      data: {
        action: "P2P_RECEIPT_UPLOADED",
        entity: "Order",
        entityId: orderId,
        meta: { rail, reference, userId: session.user.id },
      },
    }),
  ]);

  return { ok: true };
}
