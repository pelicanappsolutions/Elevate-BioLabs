"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CartItem {
  variantId: string; // identity key — the addressable SKU actually purchased
  productId: string; // parent compound — nav/display only
  slug: string;
  name: string; // combined display name, e.g. "Tirzepatide 10mg"
  sku: string;
  imageUrl?: string;
  priceCents: number; // base unit price (server re-prices with tiers at checkout)
  quantity: number;
  maxStock: number;
}

interface CartState {
  items: CartItem[];
  hydrated: boolean;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (variantId: string) => void;
  setQty: (variantId: string, qty: number) => void;
  clear: () => void;
  setHydrated: () => void;
  // selectors
  count: () => number;
  subtotalCents: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,
      add: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId);
          if (existing) {
            const nextQty = Math.min(existing.quantity + qty, item.maxStock);
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId ? { ...i, quantity: nextQty } : i
              ),
            };
          }
          return {
            items: [...state.items, { ...item, quantity: Math.min(qty, item.maxStock) }],
          };
        }),
      remove: (variantId) =>
        set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),
      setQty: (variantId, qty) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.variantId === variantId
                ? { ...i, quantity: Math.max(1, Math.min(qty, i.maxStock)) }
                : i
            )
            .filter((i) => i.quantity > 0),
        })),
      clear: () => set({ items: [] }),
      setHydrated: () => set({ hydrated: true }),
      count: () => get().items.reduce((n, i) => n + i.quantity, 0),
      subtotalCents: () =>
        get().items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
    }),
    {
      // Bumped from "ebl-cart" — CartItem now requires variantId, so any
      // stale pre-migration cart in localStorage is dropped cleanly instead
      // of rehydrating into an invalid (undefined variantId) state.
      name: "ebl-cart-v2",
      // localStorage today; swap for an IndexedDB adapter (idb-keyval) for larger
      // offline carts without touching call sites.
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    }
  )
);
