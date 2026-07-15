import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your research peptide order.",
};

// Reads the session per-request to prefill; never cached.
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await auth();

  const addresses = session?.user?.id
    ? await db.address.findMany({
        where: { userId: session.user.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      })
    : [];

  return (
    <div className="container-tight py-8 sm:py-12">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Checkout</h1>
      <div className="mt-6">
        <CheckoutFlow
          defaultEmail={session?.user?.email ?? ""}
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
