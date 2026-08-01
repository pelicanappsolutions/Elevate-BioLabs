import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { PaymentRail } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isConfigured } from "@/lib/env";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";

// Active rails for this launch:
//   - Crypto (NOWPayments)
//   - ACH / eCheck (SeamlessChex) when credentials are present
//   - Zelle + Venmo (manual P2P)
// Card rails (NexaPay/PayRam/Stripe), Coinbase, and Wire stay in the codebase
// but are muted at checkout until we intentionally re-enable them.
function getAvailableRails(): PaymentRail[] {
  const isDev = process.env.NODE_ENV !== "production";
  const configured: PaymentRail[] = [];

  if (isConfigured.nowpayments() || isDev) configured.push("NOWPAYMENTS");
  if (isConfigured.seamlesschex() || isDev) configured.push("SEAMLESSCHEX");

  return [...configured, "P2P_ZELLE", "P2P_VENMO"];
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
