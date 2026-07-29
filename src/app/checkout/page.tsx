import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { PaymentRail } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isConfigured } from "@/lib/env";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";

// Card/crypto rails only show at checkout once real credentials are set —
// P2P rails (Zelle/Venmo/Wire) need no external account and are always on.
// This means enabling/disabling a rail is purely an env-var decision on the
// hosting side; it never requires a code change here.
function getAvailableRails(): PaymentRail[] {
  const isDev = process.env.NODE_ENV !== "production";
  const configured: PaymentRail[] = [];
  // Crypto (Coinbase Commerce) is a primary rail for this vertical. Shown when
  // its key is set — and also in dev so it's testable without live keys. In
  // production it activates automatically the moment COINBASE_COMMERCE_API_KEY
  // is present.
  if (isConfigured.coinbase() || isDev) configured.push("COINBASE");
  if (isConfigured.nexapay()) configured.push("NEXAPAY");
  if (isConfigured.seamlesschex()) configured.push("SEAMLESSCHEX");
  if (isConfigured.payram()) configured.push("PAYRAM");
  if (isConfigured.stripe()) configured.push("STRIPE");
  return [...configured, "P2P_WIRE", "P2P_ZELLE", "P2P_VENMO"];
}

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your analytical reference standard order.",
};

// Reads the session per-request to prefill; never cached.
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await auth();
  // Middleware already guards /checkout; this is defense-in-depth and ensures
  // every order attributes to a real account (no anonymous guest orders).
  if (!session?.user?.id) redirect("/login?callbackUrl=/checkout");

  const addresses = await db.address.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="container-tight py-8 sm:py-12">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Checkout</h1>
      <div className="mt-6">
        <CheckoutFlow
          defaultEmail={session?.user?.email ?? ""}
          availableRails={getAvailableRails()}
          savedAddresses={addresses.map((a) => ({
            id: a.id,
            label: a.label,
            fullName: a.fullName,
            street1: a.street1,
            street2: a.street2,
            city: a.city,
            state: a.state,
            zip: a.zip,
            phone: a.phone,
            isDefault: a.isDefault,
          }))}
        />
      </div>
    </div>
  );
}
