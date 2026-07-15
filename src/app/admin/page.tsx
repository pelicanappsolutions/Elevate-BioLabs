import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, DollarSign, Package, ShoppingBag } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminProducts } from "@/components/admin/admin-products";
import { AdminOrders } from "@/components/admin/admin-orders";
import { ReceiptQueue } from "@/components/admin/receipt-queue";
import { CoaUploader } from "@/components/admin/coa-uploader";
import { EmailCampaignManager } from "@/components/admin/email-campaign-manager";
import { ComplianceTracker } from "@/components/admin/compliance-tracker";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PAID_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export default async function AdminPage() {
  const session = await auth();
  // Middleware guards /admin, but re-check here so a direct RSC hit can't leak data.
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    products,
    categories,
    orders,
    pendingReceipts,
    revenueAgg,
    orderCount,
    lowStock,
    chargebackMetrics,
    complianceDocs,
    recentCampaigns,
  ] = await Promise.all([
    db.product.findMany({
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        _count: { select: { coas: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    db.order.findMany({
      include: { items: true, payments: { take: 1, orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.paymentReceipt.findMany({
      where: { approved: false, reviewedAt: null },
      include: { order: { include: { items: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.order.aggregate({
      _sum: { totalCents: true },
      where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: thirtyDaysAgo } },
    }),
    db.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.product.findMany({
      where: { active: true, stock: { lte: 10 } },
      select: { id: true, name: true, sku: true, stock: true },
      orderBy: { stock: "asc" },
      take: 10,
    }),
    db.chargebackMetric.findMany({ orderBy: { periodStart: "desc" }, take: 8 }),
    db.complianceDoc.findMany({ orderBy: { updatedAt: "desc" } }),
    db.campaignEvent.groupBy({
      by: ["type", "status"],
      _count: { _all: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  const revenue = revenueAgg._sum.totalCents ?? 0;

  return (
    <div className="container-tight py-8 sm:py-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admin</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Signed in as {session.user.email} • Last 30 days
        </p>
      </div>

      {/* KPI strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={DollarSign}
          label="Revenue (30d)"
          value={formatPrice(revenue)}
          hint={`${orderCount} orders placed`}
        />
        <Kpi
          icon={ShoppingBag}
          label="Awaiting review"
          value={String(pendingReceipts.length)}
          hint="P2P receipts in queue"
          alert={pendingReceipts.length > 0}
        />
        <Kpi
          icon={Package}
          label="Low stock"
          value={String(lowStock.length)}
          hint="At or below threshold"
          alert={lowStock.length > 0}
        />
        <Kpi
          icon={AlertTriangle}
          label="Active products"
          value={String(products.filter((p) => p.active).length)}
          hint={`${products.length} total`}
        />
      </div>

      {lowStock.length > 0 && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs font-semibold text-destructive">Low stock alert</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {lowStock.map((p) => `${p.name} (${p.stock})`).join(" • ")}
          </p>
        </div>
      )}

      <Tabs defaultValue="orders" className="mt-6">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto">
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="receipts">
              P2P queue{pendingReceipts.length > 0 ? ` (${pendingReceipts.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="coa">COAs</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="orders" className="mt-6">
          <AdminOrders
            orders={orders.map((o) => ({
              id: o.id,
              orderNumber: o.orderNumber,
              status: o.status,
              totalCents: o.totalCents,
              createdAt: o.createdAt.toISOString(),
              trackingNumber: o.trackingNumber,
              labelUrl: o.labelUrl,
              shipService: o.shipService,
              guestEmail: o.guestEmail,
              shipTo: o.shipTo as Record<string, string> | null,
              rail: o.payments[0]?.rail ?? null,
              items: o.items.map((i) => ({
                id: i.id,
                name: i.name,
                quantity: i.quantity,
                totalCents: i.totalCents,
              })),
            }))}
          />
        </TabsContent>

        <TabsContent value="receipts" className="mt-6">
          <ReceiptQueue
            receipts={pendingReceipts.map((r) => ({
              id: r.id,
              rail: r.rail,
              fileUrl: r.fileUrl,
              reference: r.reference,
              amountCents: r.amountCents,
              createdAt: r.createdAt.toISOString(),
              order: {
                orderNumber: r.order.orderNumber,
                totalCents: r.order.totalCents,
                guestEmail: r.order.guestEmail,
              },
            }))}
          />
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <AdminProducts
            products={products.map((p) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              slug: p.slug,
              description: p.description,
              cas: p.cas,
              purity: p.purity,
              molarMass: p.molarMass,
              sequence: p.sequence,
              form: p.form,
              storageInfo: p.storageInfo,
              priceCents: p.priceCents,
              compareAtCents: p.compareAtCents,
              stock: p.stock,
              lowStockThreshold: p.lowStockThreshold,
              categoryId: p.categoryId,
              categoryName: p.category?.name ?? null,
              active: p.active,
              featured: p.featured,
              coaCount: p._count.coas,
              imageUrl: p.images[0]?.url ?? null,
            }))}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
        </TabsContent>

        <TabsContent value="coa" className="mt-6">
          <CoaUploader
            products={products.map((p) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              coaCount: p._count.coas,
            }))}
          />
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <EmailCampaignManager
            recentCampaigns={recentCampaigns.map((c) => ({
              type: c.type,
              status: c.status,
              count: c._count._all,
            }))}
          />
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <ComplianceTracker
            metrics={chargebackMetrics.map((m) => ({
              id: m.id,
              rail: m.rail,
              periodStart: m.periodStart.toISOString(),
              periodEnd: m.periodEnd.toISOString(),
              txnCount: m.txnCount,
              chargebacks: m.chargebacks,
              ratio: m.ratio,
              thresholdPct: m.thresholdPct,
              breached: m.breached,
            }))}
            docs={complianceDocs.map((d) => ({
              id: d.id,
              title: d.title,
              slug: d.slug,
              category: d.category,
              active: d.active,
              fileUrl: d.fileUrl,
              updatedAt: d.updatedAt.toISOString(),
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  alert,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon
          className={`h-4 w-4 ${alert ? "text-destructive" : "text-primary"}`}
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
