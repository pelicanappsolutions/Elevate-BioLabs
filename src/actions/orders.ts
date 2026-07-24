"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { variantDisplayName } from "@/lib/utils";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user;
}

export interface ReorderItem {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  priceCents: number;
  maxStock: number;
}

/**
 * Build a cart-ready payload from a past order. OrderItem is a frozen snapshot
 * lacking slug/imageUrl/live stock, so we re-resolve each item's CURRENT
 * variant and skip anything discontinued or out of stock. Ownership-checked.
 */
export async function getReorderPayload(orderId: string): Promise<{
  ok: boolean;
  error?: string;
  items: ReorderItem[];
  skipped: { name: string; reason: "discontinued" | "out_of_stock" }[];
}> {
  const user = await requireUser().catch(() => null);
  if (!user) return { ok: false, error: "Unauthorized", items: [], skipped: [] };

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { userId: true, items: { select: { variantId: true, name: true } } },
  });
  if (!order || order.userId !== user.id) {
    return { ok: false, error: "Order not found.", items: [], skipped: [] };
  }

  const variantIds = order.items.map((i) => i.variantId);
  const variants = variantIds.length
    ? await db.productVariant.findMany({
        where: { id: { in: variantIds } },
        include: {
          product: { select: { slug: true, name: true } },
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
      })
    : [];
  const vMap = new Map(variants.map((v) => [v.id, v]));

  const items: ReorderItem[] = [];
  const skipped: { name: string; reason: "discontinued" | "out_of_stock" }[] = [];

  for (const item of order.items) {
    const v = vMap.get(item.variantId);
    if (!v || !v.active) {
      skipped.push({ name: item.name, reason: "discontinued" });
      continue;
    }
    if (v.stock <= 0) {
      skipped.push({ name: item.name, reason: "out_of_stock" });
      continue;
    }
    items.push({
      variantId: v.id,
      productId: v.productId,
      slug: v.product.slug,
      name: variantDisplayName(v.product.name, v.strengthMg),
      sku: v.sku,
      imageUrl: v.images[0]?.url ?? null,
      priceCents: v.priceCents,
      maxStock: v.stock,
    });
  }

  return { ok: true, items, skipped };
}
