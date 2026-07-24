import { db } from "@/lib/db";
import { variantDisplayName } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";

const PAID_STATUSES: OrderStatus[] = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"];

export interface AnalyticsDTO {
  revenueSeries: { day: string; label: string; value: number }[]; // 30 entries, cents
  topProducts: { label: string; quantity: number; revenue: number }[]; // ≤10
  revenueByRail: { rail: string; value: number }[];
  revenueByCategory: { category: string; value: number }[];
  aovCents: number;
  totalRevenueCents: number;
  orderCount: number;
}

/**
 * Server-only analytics aggregation for the admin dashboard. All returns are
 * plain serializable numbers/strings. Date bucketing (revenue-over-time) is
 * done in JS rather than SQL date_trunc to avoid timezone drift between
 * Postgres and the Node render and to keep everything in Prisma's typed API.
 */
export async function getAnalyticsData(): Promise<AnalyticsDTO> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [paidOrders, topItemsRaw, railGroups, categoryItemsRaw] = await Promise.all([
    // Revenue-over-time source + AOV/total: paid orders in the window.
    db.order.findMany({
      where: { status: { in: PAID_STATUSES }, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, totalCents: true },
    }),
    // Top products by units sold (all time).
    db.orderItem.groupBy({
      by: ["variantId"],
      _sum: { quantity: true, totalCents: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    }),
    // Revenue by rail: successful payments only.
    db.payment.groupBy({
      by: ["rail"],
      _sum: { amountCents: true },
      where: { status: "SUCCEEDED" },
    }),
    // Revenue by category source: sum line revenue per product.
    db.orderItem.groupBy({
      by: ["productId"],
      _sum: { totalCents: true },
    }),
  ]);

  // ---- Revenue over time: pre-seed 30 zero-buckets, then add ----
  const dayKey = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const buckets = new Map<string, number>();
  const series: { day: string; label: string; value: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = dayKey(d);
    buckets.set(key, 0);
    series.push({
      day: key,
      label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d),
      value: 0,
    });
  }
  for (const o of paidOrders) {
    const key = dayKey(o.createdAt);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + o.totalCents);
  }
  for (const entry of series) entry.value = buckets.get(entry.day) ?? 0;

  const totalRevenueCents = paidOrders.reduce((s, o) => s + o.totalCents, 0);
  const orderCount = paidOrders.length;
  const aovCents = orderCount > 0 ? Math.round(totalRevenueCents / orderCount) : 0;

  // ---- Top products: resolve variant display names ----
  const variantIds = topItemsRaw.map((r) => r.variantId);
  const variants = variantIds.length
    ? await db.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, strengthMg: true, product: { select: { name: true } } },
      })
    : [];
  const vMap = new Map(variants.map((v) => [v.id, variantDisplayName(v.product.name, v.strengthMg)]));
  const topProducts = topItemsRaw.map((r) => ({
    label: vMap.get(r.variantId) ?? "Unknown",
    quantity: r._sum.quantity ?? 0,
    revenue: r._sum.totalCents ?? 0,
  }));

  // ---- Revenue by rail ----
  const revenueByRail = railGroups
    .map((g) => ({ rail: g.rail.replace(/_/g, " "), value: g._sum.amountCents ?? 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  // ---- Revenue by category ----
  const productIds = categoryItemsRaw.map((r) => r.productId);
  const productsForCat = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, category: { select: { name: true } } },
      })
    : [];
  const catOfProduct = new Map(
    productsForCat.map((p) => [p.id, p.category?.name ?? "Uncategorized"])
  );
  const catTotals = new Map<string, number>();
  for (const r of categoryItemsRaw) {
    const cat = catOfProduct.get(r.productId) ?? "Uncategorized";
    catTotals.set(cat, (catTotals.get(cat) ?? 0) + (r._sum.totalCents ?? 0));
  }
  const revenueByCategory = [...catTotals.entries()]
    .map(([category, value]) => ({ category, value }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  return {
    revenueSeries: series,
    topProducts,
    revenueByRail,
    revenueByCategory,
    aovCents,
    totalRevenueCents,
    orderCount,
  };
}
