import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** cents -> "$89.99" */
export function formatPrice(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

/** "Jul 3, 2026, 2:15 PM" — date + time, for logs and payment timestamps. */
export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

/** EBL-8Q3F2K */
export function generateOrderNumber() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `EBL-${rand}`;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Resolve the best unit price for a given quantity against bulk tiers. */
export function resolveUnitPrice(
  basePriceCents: number,
  tiers: { minQty: number; unitPriceCents: number }[],
  qty: number
): number {
  const applicable = tiers
    .filter((t) => qty >= t.minQty)
    .sort((a, b) => b.minQty - a.minQty)[0];
  return applicable ? applicable.unitPriceCents : basePriceCents;
}

/** "Tirzepatide" + 10 -> "Tirzepatide 10mg" */
export function variantDisplayName(productName: string, strengthMg: number) {
  const mg = Number.isInteger(strengthMg) ? strengthMg : strengthMg.toFixed(1);
  return `${productName} ${mg}mg`;
}

/** Orders at or above this subtotal ship free — enforced authoritatively in
 *  priceCart(); this copy is here (not pricing.ts) so client components can
 *  import it without pulling in the server-only Prisma client. */
export const FREE_SHIPPING_THRESHOLD_CENTS = 15000;

export function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
