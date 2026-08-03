import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, DollarSign, Package, ShoppingBag } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPrice, variantDisplayName } from "@/lib/utils";
import { getAnalyticsData } from "@/lib/analytics";
import { AdminAnalytics } from "@/components/admin/admin-analytics";
import { AdminCustomers } from "@/components/admin/admin-customers";
import { AdminActivity } from "@/components/admin/admin-activity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminProducts } from "@/components/admin/admin-products";
import { AdminOrders } from "@/components/admin/admin-orders";
import { ReceiptQueue } from "@/components/admin/receipt-queue";
import { EmailNotificationQueue } from "@/components/admin/email-notification-queue";
import { CoaUploader } from "@/components/admin/coa-uploader";
import { EmailCampaignManager } from "@/components/admin/email-campaign-manager";
import { ComplianceTracker } from "@/components/admin/compliance-tracker";
import { SendGridTrialAlert } from "@/components/admin/sendgrid-trial-alert";
import { AccountSettings } from "@/components/account/account-settings";

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
    pendingEmailNotifications,
    revenueAgg,
    orderCount,
    lowStock,
    chargebackMetrics,
    complianceDocs,
    recentCampaigns,
    currentUser,
    analytics,
    customerRows,
    customerSpend,
    auditLogs,
    inventoryLogs,
    marketingSubscriberCount,
  ] = await Promise.all([
    db.product.findMany({
      include: {
        category: true,
        variants: {
          orderBy: [{ sortOrder: "asc" }, { strengthMg: "asc" }],
          include: {
            images: { orderBy: { sortOrder: "asc" }, take: 1 },
            coas: { orderBy: { createdAt: "desc" }, select: { id: true, batchLot: true, fileUrl: true, purity: true, testedOn: true } },
          },
        },
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
    db.emailPaymentNotification.findMany({
      where: { status: { in: ["PENDING", "NEEDS_REVIEW"] } },
      include: { order: { include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    db.order.aggregate({
      _sum: { totalCents: true },
      where: { status: { in: [...PAID_STATUSES] }, createdAt: { gte: thirtyDaysAgo } },
    }),
    db.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.productVariant.findMany({
      where: { active: true, stock: { lte: 10 } },
      select: { id: true, sku: true, stock: true, strengthMg: true, product: { select: { name: true } } },
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
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        image: true,
        marketingOptIn: true,
        passwordHash: true,
        createdAt: true,
      },
    }),
    getAnalyticsData(),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
    db.order.groupBy({
      by: ["userId"],
      _sum: { totalCents: true },
      where: { status: { in: [...PAID_STATUSES] } },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { user: { select: { email: true } } },
    }),
    db.inventoryLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        variant: { select: { strengthMg: true, product: { select: { name: true } } } },
      },
    }),
    db.marketingSubscriber.count({ where: { active: true } }),
  ]);

  // InventoryLog.orderId is a plain scalar (no relation), so resolve order
  // numbers for the ones that reference an order in one batched lookup.
  const invOrderIds = Array.from(
    new Set(inventoryLogs.map((i) => i.orderId).filter((x): x is string => x != null))
  );
  const invOrders = invOrderIds.length
    ? await db.order.findMany({ where: { id: { in: invOrderIds } }, select: { id: true, orderNumber: true } })
    : [];
  const orderNumberById = new Map(invOrders.map((o) => [o.id, o.orderNumber]));

  const spendByUser = new Map(
    customerSpend
      .filter((s) => s.userId != null)
      .map((s) => [s.userId as string, s._sum.totalCents ?? 0])
  );
  const customers = customerRows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    joinedAt: u.createdAt.toISOString(),
    orderCount: u._count.orders,
    lifetimeSpendCents: spendByUser.get(u.id) ?? 0,
  }));

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
          value={String(pendingReceipts.length + pendingEmailNotifications.length)}
          hint="P2P receipts + email notifications"
          alert={pendingReceipts.length + pendingEmailNotifications.length > 0}
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
          label="Active compounds"
          value={String(products.filter((p) => p.active).length)}
          hint={`${products.length} total`}
        />
      </div>

      {lowStock.length > 0 && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs font-semibold text-destructive">Low stock alert</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {lowStock
              .map((v) => `${variantDisplayName(v.product.name, v.strengthMg)} (${v.stock})`)
              .join(" • ")}
          </p>
        </div>
      )}

      <SendGridTrialAlert />

      <Tabs defaultValue="orders" className="mt-6">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto">
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="receipts">
              P2P receipts{pendingReceipts.length > 0 ? ` (${pendingReceipts.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="p2p-email">
              P2P email
              {pendingEmailNotifications.length > 0 ? ` (${pendingEmailNotifications.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="coa">COAs</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
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

        <TabsContent value="analytics" className="mt-6">
          <AdminAnalytics data={analytics} />
        </TabsContent>

        <TabsContent value="customers" className="mt-6">
          <AdminCustomers customers={customers} currentAdminId={session.user.id} />
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

        <TabsContent value="p2p-email" className="mt-6">
          <EmailNotificationQueue
            notifications={pendingEmailNotifications.map((n) => ({
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
            }))}
          />
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <AdminProducts
            products={products.map((p) => ({
              id: p.id,
              name: p.name,
              slug: p.slug,
              description: p.description,
              cas: p.cas,
              purity: p.purity,
              molarMass: p.molarMass,
              sequence: p.sequence,
              form: p.form,
              storageInfo: p.storageInfo,
              categoryId: p.categoryId,
              categoryName: p.category?.name ?? null,
              active: p.active,
              featured: p.featured,
              highRisk: p.highRisk,
              variants: p.variants.map((v) => ({
                id: v.id,
                sku: v.sku,
                strengthMg: v.strengthMg,
                priceCents: v.priceCents,
                compareAtCents: v.compareAtCents,
                stock: v.stock,
                lowStockThreshold: v.lowStockThreshold,
                active: v.active,
                sortOrder: v.sortOrder,
                coaCount: v.coas.length,
                imageUrl: v.images[0]?.url ?? null,
                reconstitutionVolumeMl: v.reconstitutionVolumeMl,
              })),
            }))}
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              description: c.description,
              sortOrder: c.sortOrder,
              productCount: products.filter((p) => p.categoryId === c.id).length,
            }))}
          />
        </TabsContent>

        <TabsContent value="coa" className="mt-6">
          <CoaUploader
            products={products.flatMap((p) =>
              p.variants.map((v) => ({
                id: v.id,
                name: variantDisplayName(p.name, v.strengthMg),
                sku: v.sku,
                coaCount: v.coas.length,
                coas: v.coas.map((c) => ({
                  id: c.id,
                  batchLot: c.batchLot,
                  fileUrl: c.fileUrl,
                  purity: c.purity,
                  testedOn: c.testedOn?.toISOString() ?? "",
                })),
              }))
            )}
          />
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <EmailCampaignManager
            subscriberCount={marketingSubscriberCount}
            recentCampaigns={recentCampaigns.map((c) => ({
              type: c.type,
              status: c.status,
              count: c._count._all,
            }))}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <AdminActivity
            audit={auditLogs.map((a) => ({
              id: a.id,
              userEmail: a.user?.email ?? "system",
              action: a.action,
              entity: a.entity,
              entityId: a.entityId,
              meta: a.meta,
              ip: a.ip,
              createdAt: a.createdAt.toISOString(),
            }))}
            inventory={inventoryLogs.map((i) => ({
              id: i.id,
              variantName: variantDisplayName(i.variant.product.name, i.variant.strengthMg),
              reason: i.reason,
              delta: i.delta,
              before: i.before,
              after: i.after,
              orderId: i.orderId,
              orderNumber: i.orderId ? orderNumberById.get(i.orderId) ?? null : null,
              note: i.note,
              createdAt: i.createdAt.toISOString(),
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

        <TabsContent value="settings" className="mt-6">
          <AccountSettings
            name={currentUser?.name ?? ""}
            email={currentUser?.email ?? session.user.email ?? ""}
            image={currentUser?.image ?? null}
            marketingOptIn={currentUser?.marketingOptIn ?? false}
            memberSince={currentUser?.createdAt?.toISOString() ?? null}
            hasPassword={!!currentUser?.passwordHash}
            showMarketing={false}
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
