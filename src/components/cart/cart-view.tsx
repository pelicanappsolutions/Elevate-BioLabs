"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FlaskConical, ShoppingBag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/utils";
import { useCart, type CartItem } from "@/store/cart";

export function CartView() {
  const hydrated = useCart((s) => s.hydrated);
  const items = useCart((s) => s.items);
  const subtotal = useCart((s) => s.subtotalCents());
  const clear = useCart((s) => s.clear);

  // The cart lives in localStorage, so the server render has no items. Render a
  // skeleton until rehydration lands to avoid a hydration mismatch + CLS jump.
  if (!hydrated) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">Your cart is empty</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Browse the catalog and add a few compounds — bulk tiers apply automatically.
        </p>
        <Button asChild className="mt-5">
          <Link href="/products">Browse catalog</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground sm:hidden">
          Tip: swipe a row left to remove it.
        </p>
        {items.map((item) => (
          <CartLineItem key={item.productId} item={item} />
        ))}

        <div className="flex justify-between pt-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/products">Continue shopping</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            className="text-muted-foreground hover:text-destructive"
          >
            Clear cart
          </Button>
        </div>
      </div>

      {/* Summary — sticky on desktop, sticky footer CTA on mobile */}
      <div className="lg:sticky lg:top-8">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-semibold">Order summary</h2>
          <dl className="mt-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-medium">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="text-muted-foreground">Calculated at checkout</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="text-muted-foreground">Calculated at checkout</dd>
            </div>
          </dl>
          <Separator className="my-4" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Estimated total</span>
            <span className="text-xl font-bold">{formatPrice(subtotal)}</span>
          </div>

          <Button asChild size="lg" className="tap mt-4 w-full">
            <Link href="/checkout">
              Checkout
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            All items are supplied For Research Use Only. By checking out you confirm you
            are 18+ and will not administer these compounds to humans or animals.
          </p>
        </div>
      </div>

      {/* Mobile sticky checkout bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
        <Button asChild size="lg" className="tap w-full">
          <Link href="/checkout">
            Checkout • {formatPrice(subtotal)}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
      <div className="h-16 lg:hidden" aria-hidden="true" />
    </div>
  );
}

const SWIPE_THRESHOLD = 96;

function CartLineItem({ item }: { item: CartItem }) {
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);

  const [offset, setOffset] = React.useState(0);
  const startX = React.useRef<number | null>(null);

  /** Swipe-left-to-remove. Only tracks leftward drags, and only commits past the
   *  threshold so an accidental brush doesn't delete a line. */
  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchMove(e: React.TouchEvent) {
    const touchX = e.touches[0]?.clientX;
    if (startX.current == null || touchX == null) return;
    setOffset(Math.min(0, touchX - startX.current));
  }
  function onTouchEnd() {
    if (offset < -SWIPE_THRESHOLD) remove(item.productId);
    setOffset(0);
    startX.current = null;
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Reveal layer behind the row */}
      <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-destructive text-destructive-foreground">
        <Trash2 className="h-5 w-5" aria-hidden="true" />
      </div>

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${offset}px)` }}
        className="relative flex gap-3 border border-border bg-card p-3 transition-transform duration-150 ease-out"
      >
        <Link
          href={`/products/${item.slug}`}
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-secondary"
        >
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FlaskConical className="h-6 w-6 text-primary/50" aria-hidden="true" />
            </div>
          )}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            href={`/products/${item.slug}`}
            className="line-clamp-2 text-sm font-semibold hover:text-primary"
          >
            {item.name}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">SKU {item.sku}</p>

          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
            <div className="flex items-center rounded-md border border-border">
              <button
                type="button"
                aria-label={`Decrease quantity of ${item.name}`}
                onClick={() => setQty(item.productId, item.quantity - 1)}
                className="flex h-9 w-9 items-center justify-center text-lg leading-none transition-colors hover:bg-accent"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
              <button
                type="button"
                aria-label={`Increase quantity of ${item.name}`}
                disabled={item.quantity >= item.maxStock}
                onClick={() => setQty(item.productId, item.quantity + 1)}
                className="flex h-9 w-9 items-center justify-center text-lg leading-none transition-colors hover:bg-accent disabled:opacity-40"
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">
                {formatPrice(item.priceCents * item.quantity)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${item.name} from cart`}
                onClick={() => remove(item.productId)}
                className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:flex"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CartView;
