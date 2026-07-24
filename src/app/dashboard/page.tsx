import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { variantDisplayName } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { OrderHistory } from "@/components/dashboard/order-history";
import { SavedProducts } from "@/components/dashboard/saved-products";
import { DosageLogPanel } from "@/components/dashboard/dosage-log-panel";
import { AddressBook } from "@/components/dashboard/address-book";
import { AccountSettings } from "@/components/account/account-settings";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  // Middleware already guards this route; this is defense-in-depth and narrows
  // the type for the queries below.
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");

  const userId = session.user.id;

  const [orders, saved, doseLogs, addresses, user] = await Promise.all([
    db.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    db.savedProduct.findMany({
      where: { userId },
      include: {
        variant: {
          include: {
            images: { orderBy: { sortOrder: "asc" }, take: 1 },
            product: { select: { id: true, slug: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.dosageLog.findMany({
      where: { userId },
      include: { variant: { select: { strengthMg: true, product: { select: { name: true } } } } },
      orderBy: { dateTaken: "desc" },
      take: 50,
    }),
    db.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
    db.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        createdAt: true,
        image: true,
        marketingOptIn: true,
        passwordHash: true,
      },
    }),
  ]);

  const activeOrders = orders.filter(
    (o) => !["DELIVERED", "CANCELLED", "REFUNDED"].includes(o.status)
  ).length;

  // Variant options for linking a dosage-log entry — drawn from what the user
  // has purchased (OrderItem carries the frozen display name) plus saved items.
  const variantOptionMap = new Map<string, string>();
  for (const o of orders) {
    for (const it of o.items) variantOptionMap.set(it.variantId, it.name);
  }
  for (const s of saved) {
    variantOptionMap.set(
      s.variant.id,
      variantDisplayName(s.variant.product.name, s.variant.strengthMg)
    );
  }
  const variantOptions = [...variantOptionMap.entries()].map(([id, label]) => ({ id, label }));

  return (
    <div className="container-tight py-8 sm:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {user?.name ? `Welcome back, ${user.name.split(" ")[0]}` : "Your dashboard"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {orders.length} order{orders.length === 1 ? "" : "s"} • {activeOrders} in
            progress
          </p>
        </div>
        <SignOutButton />
      </div>

      <Tabs defaultValue="orders" className="mt-6">
        {/* Horizontally scrollable tab strip so nothing truncates on phones */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto">
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="saved">Saved ({saved.length})</TabsTrigger>
            <TabsTrigger value="doses">Dosage log</TabsTrigger>
            <TabsTrigger value="addresses">Addresses</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="orders" className="mt-6">
          <OrderHistory orders={orders} />
        </TabsContent>

        <TabsContent value="saved" className="mt-6">
          <SavedProducts
            items={saved.map((s) => ({
              id: s.id,
              variant: {
                variantId: s.variant.id,
                productId: s.variant.product.id,
                productSlug: s.variant.product.slug,
                productName: s.variant.product.name,
                strengthMg: s.variant.strengthMg,
                sku: s.variant.sku,
                priceCents: s.variant.priceCents,
                compareAtCents: s.variant.compareAtCents,
                stock: s.variant.stock,
                images: s.variant.images.map((i) => ({ url: i.url, alt: i.alt })),
              },
            }))}
          />
        </TabsContent>

        <TabsContent value="doses" className="mt-6">
          <DosageLogPanel
            variantOptions={variantOptions}
            logs={doseLogs.map((l) => ({
              id: l.id,
              dateTaken: l.dateTaken.toISOString(),
              variantId: l.variantId,
              doseMcg: l.doseMcg,
              volumeMl: l.volumeMl,
              note: l.note,
              productName: l.variant
                ? variantDisplayName(l.variant.product.name, l.variant.strengthMg)
                : null,
            }))}
          />
        </TabsContent>

        <TabsContent value="addresses" className="mt-6">
          <AddressBook addresses={addresses} />
        </TabsContent>

        <TabsContent value="profile" className="mt-6">
          <AccountSettings
            name={user?.name ?? ""}
            email={user?.email ?? ""}
            image={user?.image ?? null}
            marketingOptIn={user?.marketingOptIn ?? false}
            memberSince={user?.createdAt?.toISOString() ?? null}
            hasPassword={!!user?.passwordHash}
            showMarketing
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
