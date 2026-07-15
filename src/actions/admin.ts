"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { productSchema, restockSchema } from "@/lib/validations";
import { adjustStock } from "@/lib/inventory";
import { uploadFile } from "@/lib/storage";
import { createLabel } from "@/lib/shipping/usps";
import { sendTransactional, trackMarketing } from "@/lib/email/index";
import { slugify } from "@/lib/utils";
import type { OrderStatus, CampaignType } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session.user;
}

async function audit(userId: string, action: string, entity: string, entityId: string, meta?: object) {
  await db.auditLog.create({ data: { userId, action, entity, entityId, meta: meta ?? {} } });
}

// ---------------- Products ----------------

export async function upsertProduct(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const withDefaults = {
    ...(input as Record<string, unknown>),
    slug: (input as { slug?: string }).slug || slugify(String((input as { name?: string }).name ?? "")),
  };
  const parsed = productSchema.safeParse(withDefaults);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid product" };

  const { ...data } = parsed.data;
  const id = (input as { id?: string }).id;

  const saved = id
    ? await db.product.update({ where: { id }, data })
    : await db.product.create({ data });

  await audit(admin.id, id ? "PRODUCT_UPDATED" : "PRODUCT_CREATED", "Product", saved.id);
  revalidatePath("/admin");
  revalidatePath("/products");
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<{ ok: boolean }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false };
  // Soft-delete to preserve order history integrity.
  await db.product.update({ where: { id }, data: { active: false } });
  await audit(admin.id, "PRODUCT_DEACTIVATED", "Product", id);
  revalidatePath("/admin");
  return { ok: true };
}

export async function restockProduct(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };
  const parsed = restockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid restock" };

  try {
    await adjustStock(parsed.data.productId, parsed.data.delta, "RESTOCK", parsed.data.note);
    await audit(admin.id, "RESTOCK", "Product", parsed.data.productId, { delta: parsed.data.delta });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restock failed" };
  }
}

// ---------------- Orders ----------------

export async function updateOrderStatus(input: {
  orderId: string;
  status: string;
}): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const order = await db.order.update({
    where: { id: input.orderId },
    data: { status: input.status as OrderStatus },
  });
  await audit(admin.id, "ORDER_STATUS_CHANGE", "Order", order.id, { status: input.status });
  revalidatePath("/admin");
  return { ok: true };
}

export async function createShippingLabel(
  orderId: string
): Promise<{ ok: boolean; trackingNumber?: string; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { ok: false, error: "Order not found" };

  const shipTo = (order.shipTo ?? {}) as Record<string, string>;
  const weightOz = 4 + order.items.reduce((n, i) => n + i.quantity, 0) * 2;

  try {
    const label = await createLabel({
      toName: shipTo.fullName ?? "Customer",
      toStreet1: shipTo.street1 ?? "",
      toStreet2: shipTo.street2,
      toCity: shipTo.city ?? "",
      toState: shipTo.state ?? "",
      toZip: shipTo.zip ?? "",
      weightOz,
      service: order.shipService ?? "USPS_PRIORITY",
    });

    const updated = await db.order.update({
      where: { id: orderId },
      data: {
        trackingNumber: label.trackingNumber,
        labelUrl: label.labelUrl,
        status: "SHIPPED",
        shippedAt: new Date(),
      },
    });

    // Email + marketing shipment notification.
    const to = order.guestEmail ?? (await customerEmail(order.userId));
    if (to) {
      await sendTransactional("SHIPMENT_TRACKING", { to, order: updated });
      await trackMarketing("SHIPMENT_TRACKING", to, updated);
    }
    await audit(admin.id, "LABEL_CREATED", "Order", orderId, { tracking: label.trackingNumber });
    revalidatePath("/admin");
    return { ok: true, trackingNumber: label.trackingNumber };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Label creation failed" };
  }
}

// ---------------- P2P receipt verification ----------------

export async function approveReceipt(receiptId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const receipt = await db.paymentReceipt.findUnique({ where: { id: receiptId } });
  if (!receipt) return { ok: false, error: "Receipt not found" };

  await db.$transaction([
    db.paymentReceipt.update({
      where: { id: receiptId },
      data: { approved: true, reviewedById: admin.id, reviewedAt: new Date() },
    }),
    db.order.update({ where: { id: receipt.orderId }, data: { status: "PAID" } }),
    db.payment.updateMany({
      where: { orderId: receipt.orderId, rail: receipt.rail },
      data: { status: "SUCCEEDED" },
    }),
  ]);

  const order = await db.order.findUnique({ where: { id: receipt.orderId } });
  const to = order?.guestEmail ?? (await customerEmail(order?.userId ?? null));
  if (order && to) {
    await sendTransactional("ORDER_CONFIRMATION", { to, order });
    await trackMarketing("ORDER_CONFIRMATION", to, order);
  }
  await audit(admin.id, "RECEIPT_APPROVED", "PaymentReceipt", receiptId);
  revalidatePath("/admin");
  return { ok: true };
}

export async function rejectReceipt(receiptId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const receipt = await db.paymentReceipt.update({
    where: { id: receiptId },
    data: { approved: false, reviewedById: admin.id, reviewedAt: new Date() },
  });
  await db.order.update({ where: { id: receipt.orderId }, data: { status: "PENDING_PAYMENT" } });
  await audit(admin.id, "RECEIPT_REJECTED", "PaymentReceipt", receiptId);
  revalidatePath("/admin");
  return { ok: true };
}

// ---------------- COA upload ----------------

export async function uploadCoa(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const productId = String(formData.get("productId") ?? "");
  const batchLot = String(formData.get("batchLot") ?? "");
  const purity = formData.get("purity") ? String(formData.get("purity")) : undefined;
  const testedOn = formData.get("testedOn") ? new Date(String(formData.get("testedOn"))) : undefined;
  const file = formData.get("file");

  if (!productId || !batchLot) return { ok: false, error: "Product and batch/lot required." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Attach a COA PDF." };

  const uploaded = await uploadFile(file, file.name, "coa");
  await db.cOA.create({
    data: { productId, batchLot, purity, testedOn, fileUrl: uploaded.url },
  });
  await audit(admin.id, "COA_UPLOADED", "Product", productId, { batchLot });
  revalidatePath("/admin");
  return { ok: true };
}

// ---------------- Email campaigns ----------------

export async function triggerCampaign(input: {
  type: string;
  segment?: string;
}): Promise<{ ok: boolean; error?: string; count?: number }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  // Resolve a recipient set from the segment (all customers for a blast).
  const users = await db.user.findMany({
    where: { role: "CUSTOMER" },
    select: { email: true },
    take: 5000,
  });

  let count = 0;
  for (const u of users) {
    await trackMarketing(input.type as CampaignType, u.email).catch(() => {});
    count++;
  }
  await audit(admin.id, "CAMPAIGN_TRIGGERED", "CampaignEvent", input.type, { count });
  revalidatePath("/admin");
  return { ok: true, count };
}

async function customerEmail(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const u = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  return u?.email ?? null;
}
