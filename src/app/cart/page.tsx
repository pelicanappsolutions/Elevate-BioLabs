import type { Metadata } from "next";

import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = {
  title: "Your Cart",
  description: "Review your analytical reference standard order before checkout.",
};

export default function CartPage() {
  return (
    <div className="container-tight py-8 sm:py-12">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your cart</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Prices are re-verified server-side at checkout, including bulk tiers.
      </p>
      <div className="mt-6">
        <CartView />
      </div>
    </div>
  );
}
