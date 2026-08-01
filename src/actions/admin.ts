"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  compoundSchema,
  variantSchema,
  restockSchema,
  setUserRoleSchema,
  orderNotesSchema,
} from "@/lib/validations";
import { adjustStock, recomputeProductAggregates } from "@/lib/inventory";
import { uploadFile, deleteFile } from "@/lib/storage";
import { createLabel } from "@/lib/shipping/usps";
import { createShippoLabel } from "@/lib/shipping/shippo";
import { sendTransactional, trackMarketing } from "@/lib/email/index";
import { listMarketingEmails } from "@/lib/marketing";
import { isConfigured } from "@/lib/env";
import { confirmP2pPaymentByOrder } from "@/lib/payments/p2p-confirm";
import { slugify, variantDisplayName } from "@/lib/utils";
import type { OrderStatus, CampaignType } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session.user;
}

// AuditLog.entity convention: "Product" for compound-level actions
// (PRODUCT_CREATED/UPDATED/DEACTIVATED); "ProductVariant" for strength-level
// actions (VARIANT_CREATED/UPDATED/DEACTIVATED, VARIANT_IMAGE_UPDATED,
// RESTOCK, COA_UPLOADED) — price/stock/images/COAs all live on the variant.
async function audit(userId: string, action: string, entity: string, entityId: string, meta?: object) {
  await db.auditLog.create({ data: { userId, action, entity, entityId, meta: meta ?? {} } });
}

// ---------------- Products (compound) ----------------

export async function upsertProduct(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const withDefaults = {
    ...(input as Record<string, unknown>),
    slug: (input as { slug?: string }).slug || slugify(String((input as { name?: string }).name ?? "")),
  };
  const parsed = compoundSchema.safeParse(withDefaults);
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
  // Soft-delete to preserve order history integrity. Parent-level kill switch —
  // hides the whole compound regardless of individual variant active flags.
  await db.product.update({ where: { id }, data: { active: false } });
  await audit(admin.id, "PRODUCT_DEACTIVATED", "Product", id);
  revalidatePath("/admin");
  revalidatePath("/products");
  return { ok: true };
}

// ---------------- Variants (mg strength / SKU) ----------------

export async function upsertVariant(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const parsed = variantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid variant" };

  const { productId, ...data } = parsed.data;
  const id = (input as { id?: string }).id;

  const saved = id
    ? await db.productVariant.update({ where: { id }, data: { ...data, productId } })
    : await db.productVariant.create({ data: { ...data, productId } });

  await db.$transaction((tx) => recomputeProductAggregates(tx, productId));

  await audit(admin.id, id ? "VARIANT_UPDATED" : "VARIANT_CREATED", "ProductVariant", saved.id, { productId });
  revalidatePath("/admin");
  revalidatePath("/products");
  return { ok: true };
}

export async function deleteVariant(id: string): Promise<{ ok: boolean }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false };
  // Soft-delete, independent of the parent compound — lets one strength be
  // discontinued without touching its siblings.
  const variant = await db.productVariant.update({ where: { id }, data: { active: false } });
  await db.$transaction((tx) => recomputeProductAggregates(tx, variant.productId));
  await audit(admin.id, "VARIANT_DEACTIVATED", "ProductVariant", id);
  revalidatePath("/admin");
  revalidatePath("/products");
  return { ok: true };
}

export async function uploadVariantImage(
  formData: FormData
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const variantId = String(formData.get("variantId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const file = formData.get("file");

  if (!variantId) return { ok: false, error: "Missing variant." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image file." };
  if (!file.type.startsWith("image/")) return { ok: false, error: "File must be an image." };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Image must be under 8MB." };

  const uploaded = await uploadFile(file, file.name, "products");

  // Single primary photo per variant in this admin UI — replace rather than
  // append, so "edit the picture" behaves the way an admin expects.
  await db.$transaction([
    db.productImage.deleteMany({ where: { variantId } }),
    db.productImage.create({
      data: { variantId, url: uploaded.url, sortOrder: 0 },
    }),
  ]);

  await audit(admin.id, "VARIANT_IMAGE_UPDATED", "ProductVariant", variantId, { url: uploaded.url });
  revalidatePath("/admin");
  revalidatePath("/products");
  revalidatePath("/");
  if (slug) revalidatePath(`/products/${slug}`);
  return { ok: true, url: uploaded.url };
}

export async function restockVariant(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };
  const parsed = restockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid restock" };

  try {
    await adjustStock(parsed.data.variantId, parsed.data.delta, "RESTOCK", parsed.data.note);
    await audit(admin.id, "RESTOCK", "ProductVariant", parsed.data.variantId, { delta: parsed.data.delta });
    revalidatePath("/admin");
    revalidatePath("/products");
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

  // Prefer Shippo (test or live). Fall back to direct USPS. In production,
  // refuse local mock labels when neither provider is configured.
  const useShippo = isConfigured.shippo();
  const useUsps = isConfigured.usps();
  if (process.env.NODE_ENV === "production" && !useShippo && !useUsps) {
    return {
      ok: false,
      error: "No shipping provider configured. Add SHIPPO_API_KEY (recommended) or USPS_CLIENT_ID / USPS_CLIENT_SECRET to Vercel.",
    };
  }

  const shipTo = (order.shipTo ?? {}) as Record<string, string>;
  const weightOz = 4 + order.items.reduce((n, i) => n + i.quantity, 0) * 2;
  const labelInput = {
    toName: shipTo.fullName ?? "Customer",
    toStreet1: shipTo.street1 ?? "",
    toStreet2: shipTo.street2,
    toCity: shipTo.city ?? "",
    toState: shipTo.state ?? "",
    toZip: shipTo.zip ?? "",
    weightOz,
    service: order.shipService ?? "USPS_PRIORITY",
  };

  try {
    const label = useShippo
      ? await createShippoLabel(labelInput)
      : await createLabel(labelInput);

    const updated = await db.order.update({
      where: { id: orderId },
      data: {
        trackingNumber: label.trackingNumber,
        labelUrl: label.labelUrl,
        status: "SHIPPED",
        shippedAt: new Date(),
      },
      include: { items: true },
    });

    // Email + marketing shipment notification.
    const to = order.guestEmail ?? (await customerEmail(order.userId));
    if (to) {
      await sendTransactional("SHIPMENT_TRACKING", { to, order: updated });
      await trackMarketing("SHIPMENT_TRACKING", to, updated);
    }
    await audit(admin.id, "LABEL_CREATED", "Order", orderId, {
      tracking: label.trackingNumber,
      provider: useShippo ? "shippo" : "usps",
    });
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

  const order = await db.order.findUnique({
    where: { id: receipt.orderId },
    include: { items: true },
  });
  const to = order?.guestEmail ?? (await customerEmail(order?.userId ?? null));
  if (order && to) {
    await sendTransactional("PAYMENT_RECEIVED", { to, order });
    await trackMarketing("PAYMENT_RECEIVED", to, order);
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

/** Zelle/Venmo have no proof upload — the admin confirms directly against their
 *  own Venmo/Zelle activity (order number in the memo) and this fires the same
 *  side effects approveReceipt does, minus the receipt record. */
export async function confirmP2pPayment(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  return confirmP2pPaymentByOrder(orderId, {
    actorId: admin.id,
    actor: "admin",
    reason: "Admin confirmed payment via Venmo/Zelle activity",
  });
}

/**
 * Email the customer that payment was received and the order is being prepared
 * for shipment. Uses the checkout/account email saved on the order.
 * Safe to resend (e.g. customer asks "did you get my Venmo?").
 */
export async function notifyPaymentReceived(
  orderId: string
): Promise<{ ok: boolean; error?: string; emailed?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: { select: { email: true } } },
  });
  if (!order) return { ok: false, error: "Order not found" };

  const to = order.guestEmail ?? order.user?.email ?? (await customerEmail(order.userId));
  if (!to) return { ok: false, error: "No customer email on this order." };

  await sendTransactional("PAYMENT_RECEIVED", { to, order });
  await trackMarketing("PAYMENT_RECEIVED", to, order);
  await audit(admin.id, "PAYMENT_RECEIVED_EMAIL_SENT", "Order", orderId, { to });
  revalidatePath("/admin");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true, emailed: to };
}

// ---------------- COA upload ----------------

export async function uploadCoa(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const variantId = String(formData.get("variantId") ?? "");
  const batchLot = String(formData.get("batchLot") ?? "").trim();
  const purityRaw = formData.get("purity") ? String(formData.get("purity")).trim() : "";
  const testedOnStr = formData.get("testedOn") ? String(formData.get("testedOn")) : "";
  const file = formData.get("file");

  if (!variantId) return { ok: false, error: "Product required." };
  if (!batchLot) return { ok: false, error: "Batch/lot number required." };
  if (!purityRaw) return { ok: false, error: "Purity percentage required." };
  if (!testedOnStr) return { ok: false, error: "Test date required." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Attach a COA PDF." };

  // Validate purity is 0-100
  const purityNum = parseFloat(purityRaw.replace("%", "").trim());
  if (isNaN(purityNum) || purityNum < 0 || purityNum > 100) {
    return { ok: false, error: "Purity must be a number between 0-100." };
  }
  const purity = purityNum.toString(); // Store normalized (no %)

  // Validate test date is not in future
  const testedOn = new Date(testedOnStr);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (testedOn > today) {
    return { ok: false, error: "Test date cannot be in the future." };
  }

  // Get compound + strength name for the filename
  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    select: { strengthMg: true, product: { select: { name: true } } },
  });
  if (!variant) return { ok: false, error: "Product not found." };

  // Generate filename: {ProductName mg}_{BatchLot}_{Purity}_COA.pdf
  const filename = `${variantDisplayName(variant.product.name, variant.strengthMg)}_${batchLot}_${purity}_COA.pdf`;

  const uploaded = await uploadFile(file, filename, "coa");
  await db.cOA.create({
    data: { variantId, batchLot, purity, testedOn, fileUrl: uploaded.url },
  });
  await audit(admin.id, "COA_UPLOADED", "ProductVariant", variantId, { batchLot, filename });
  revalidatePath("/admin");
  revalidatePath("/certificates");
  revalidatePath("/verify-coa");
  return { ok: true };
}

export async function deleteCoa(id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const coa = await db.cOA.findUnique({ where: { id } });
  if (!coa) return { ok: false, error: "COA not found." };

  await deleteFile(coa.fileUrl);
  await db.cOA.delete({ where: { id } });
  await audit(admin.id, "COA_DELETED", "ProductVariant", coa.variantId, {
    batchLot: coa.batchLot,
    fileUrl: coa.fileUrl,
  });

  revalidatePath("/admin");
  revalidatePath("/certificates");
  revalidatePath("/verify-coa");
  revalidatePath(`/products`);
  return { ok: true };
}

// ---------------- Email campaigns ----------------

export async function triggerCampaign(input: {
  type: string;
  segment?: string;
}): Promise<{ ok: boolean; error?: string; count?: number }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  // Promotional blasts only go to people who opted in (account + MarketingSubscriber).
  const emails = await listMarketingEmails(5000);

  let count = 0;
  for (const email of emails) {
    await trackMarketing(input.type as CampaignType, email).catch(() => {});
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

// ---------------- Customer management ----------------

const PAID_ORDER_STATUSES: OrderStatus[] = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"];

export interface CustomerDetailDTO {
  id: string;
  name: string | null;
  email: string;
  role: string;
  joinedAt: string;
  lifetimeSpendCents: number;
  orders: { id: string; orderNumber: string; status: string; totalCents: number; createdAt: string }[];
  addresses: { id: string; label: string | null; fullName: string; city: string; state: string; zip: string }[];
  saved: { id: string; label: string }[];
}

export async function getCustomerDetail(
  userId: string
): Promise<{ ok: boolean; error?: string; customer?: CustomerDetailDTO }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const u = await db.user.findUnique({
    where: { id: userId },
    include: {
      orders: { orderBy: { createdAt: "desc" }, select: { id: true, orderNumber: true, status: true, totalCents: true, createdAt: true } },
      addresses: { select: { id: true, label: true, fullName: true, city: true, state: true, zip: true } },
      savedProducts: {
        include: { variant: { select: { strengthMg: true, product: { select: { name: true } } } } },
      },
    },
  });
  if (!u) return { ok: false, error: "Customer not found." };

  const lifetimeSpendCents = u.orders
    .filter((o) => PAID_ORDER_STATUSES.includes(o.status))
    .reduce((s, o) => s + o.totalCents, 0);

  return {
    ok: true,
    customer: {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      joinedAt: u.createdAt.toISOString(),
      lifetimeSpendCents,
      orders: u.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalCents: o.totalCents,
        createdAt: o.createdAt.toISOString(),
      })),
      addresses: u.addresses,
      saved: u.savedProducts.map((s) => ({
        id: s.id,
        label: variantDisplayName(s.variant.product.name, s.variant.strengthMg),
      })),
    },
  };
}

export async function setUserRole(
  input: unknown
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const parsed = setUserRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid role change." };
  const { userId, role } = parsed.data;

  // Can't change your own role (avoids an admin locking themselves out).
  if (userId === admin.id && role !== "ADMIN") {
    return { ok: false, error: "You can't change your own role." };
  }

  // Never demote the last remaining admin.
  if (role === "CUSTOMER") {
    const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (target?.role === "ADMIN") {
      const adminCount = await db.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) return { ok: false, error: "Can't demote the last remaining admin." };
    }
  }

  const before = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  await db.user.update({ where: { id: userId }, data: { role } });
  await audit(admin.id, "ROLE_CHANGED", "User", userId, { from: before?.role, to: role });
  revalidatePath("/admin");
  return { ok: true };
}

// ---------------- Order detail actions ----------------

export async function updateOrderNotes(
  input: unknown
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const parsed = orderNotesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid notes." };

  await db.order.update({ where: { id: parsed.data.orderId }, data: { notes: parsed.data.notes } });
  await audit(admin.id, "ORDER_NOTES_UPDATED", "Order", parsed.data.orderId);
  revalidatePath("/admin");
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  return { ok: true };
}

export async function refundOrder(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  // Payments are MOCK — no gateway call. Keep Payment[] consistent with the
  // order status so the detail view reads correctly.
  await db.$transaction([
    db.order.update({ where: { id: orderId }, data: { status: "REFUNDED" } }),
    db.payment.updateMany({
      where: { orderId, status: "SUCCEEDED" },
      data: { status: "REFUNDED" },
    }),
  ]);
  await audit(admin.id, "ORDER_REFUNDED", "Order", orderId);
  revalidatePath("/admin");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

// ---------------- P2P email notification review ----------------

export async function getPendingEmailNotifications(): Promise<{
  ok: boolean;
  notifications?: Array<{
    id: string;
    source: string;
    fromEmail: string;
    subject: string;
    amountCents: number | null;
    orderNumber: string | null;
    memo: string | null;
    status: string;
    createdAt: string;
    order: {
      id: string;
      orderNumber: string;
      totalCents: number;
      status: string;
      rail: string | null;
      guestEmail: string | null;
    } | null;
  }>;
  error?: string;
}> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const rows = await db.emailPaymentNotification.findMany({
    where: { status: { in: ["PENDING", "NEEDS_REVIEW"] } },
    include: {
      order: { include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return {
    ok: true,
    notifications: rows.map((n) => ({
      id: n.id,
      source: n.source,
      fromEmail: n.fromEmail,
      subject: n.subject,
      amountCents: n.amountCents,
      orderNumber: n.orderNumber,
      memo: n.memo,
      status: n.status,
      createdAt: n.createdAt.toISOString(),
      order: n.order
        ? {
            id: n.order.id,
            orderNumber: n.order.orderNumber,
            totalCents: n.order.totalCents,
            status: n.order.status,
            rail: n.order.payments[0]?.rail ?? null,
            guestEmail: n.order.guestEmail,
          }
        : null,
    })),
  };
}

export async function confirmEmailNotification(
  notificationId: string,
  orderId?: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  const notification = await db.emailPaymentNotification.findUnique({
    where: { id: notificationId },
  });
  if (!notification) return { ok: false, error: "Notification not found" };

  const targetOrderId = orderId ?? notification.orderId;
  if (!targetOrderId) return { ok: false, error: "No order linked to this notification" };

  const confirm = await confirmP2pPaymentByOrder(targetOrderId, {
    actorId: admin.id,
    actor: "admin",
    reason: `Confirmed from ${notification.source} email notification ${notification.id}`,
  });
  if (!confirm.ok) return confirm;

  await db.emailPaymentNotification.update({
    where: { id: notificationId },
    data: {
      status: "REVIEWED",
      orderId: targetOrderId,
      reviewedById: admin.id,
      reviewedAt: new Date(),
    },
  });

  revalidatePath("/admin");
  return { ok: true };
}

export async function ignoreEmailNotification(notificationId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, error: "Unauthorized" };

  await db.emailPaymentNotification.update({
    where: { id: notificationId },
    data: { status: "IGNORED", reviewedById: admin.id, reviewedAt: new Date() },
  });
  await audit(admin.id, "EMAIL_NOTIFICATION_IGNORED", "EmailPaymentNotification", notificationId);
  revalidatePath("/admin");
  return { ok: true };
}
