"use client";

import * as React from "react";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { cn, formatPrice, resolveUnitPrice } from "@/lib/utils";
import { useCart } from "@/store/cart";

interface Tier {
  minQty: number;
  unitPriceCents: number;
}

interface PanelProduct {
  variantId: string;
  productId: string;
  slug: string;
  name: string; // combined display name, e.g. "Tirzepatide 10mg"
  sku: string;
  priceCents: number;
  stock: number;
  imageUrl?: string;
}

export function AddToCartPanel({
  product,
  tiers,
}: {
  product: PanelProduct;
  tiers: Tier[];
}) {
  const { toast } = useToast();
  const add = useCart((s) => s.add);
  const [qty, setQty] = React.useState(1);

  // Switching strength on the parent detail page swaps `product` — without
  // this, a qty picked for one strength could silently carry over to another
  // (e.g. clamped to a different, wrong maxStock instead of resetting).
  React.useEffect(() => {
    setQty(1);
  }, [product.variantId]);

  const outOfStock = product.stock <= 0;
  // Mirrors the server's tier resolution so the displayed price matches what
  // checkout will re-compute authoritatively.
  const unitPrice = resolveUnitPrice(product.priceCents, tiers, qty);
  const savings = (product.priceCents - unitPrice) * qty;

  function addToCart() {
    if (outOfStock) return;
    add(
      {
        variantId: product.variantId,
        productId: product.productId,
        slug: product.slug,
        name: product.name,
        sku: product.sku,
        imageUrl: product.imageUrl,
        priceCents: product.priceCents,
        maxStock: product.stock,
      },
      qty
    );
    toast({
      title: "Added to cart",
      description: `${qty} × ${product.name}`,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Bulk tiers */}
      {tiers.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bulk pricing
          </h3>
          <div className="flex flex-col gap-1">
            <TierRow
              label="1+"
              price={product.priceCents}
              active={qty < (tiers[0]?.minQty ?? Infinity)}
            />
            {tiers.map((t, i) => {
              const next = tiers[i + 1];
              const active = qty >= t.minQty && (!next || qty < next.minQty);
              return (
                <TierRow
                  key={t.minQty}
                  label={`${t.minQty}+`}
                  price={t.unitPriceCents}
                  active={active}
                  onClick={() => setQty(Math.min(t.minQty, product.stock))}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Stock signal */}
      <div className="flex items-center gap-2 text-sm">
        {outOfStock ? (
          <Badge variant="secondary">Out of stock</Badge>
        ) : product.stock <= 10 ? (
          <Badge variant="destructive">Only {product.stock} left</Badge>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-primary">
            <Check className="h-4 w-4" />
            In stock — ships same day
          </span>
        )}
      </div>

      {/* Quantity stepper: 44px targets, no tiny native number spinners */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Qty</span>
        <div className="flex items-center rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={outOfStock || qty <= 1}
            aria-label="Decrease quantity"
            className="tap flex h-11 w-11 items-center justify-center rounded-l-lg transition-colors hover:bg-accent disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={qty}
            aria-label="Quantity"
            onKeyDown={(e) => {
              const navKeys = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"];
              if (e.ctrlKey || e.metaKey || e.altKey || navKeys.includes(e.key)) return;
              if (/^[0-9]$/.test(e.key)) return;
              e.preventDefault();
            }}
            onPaste={(e) => {
              e.preventDefault();
              const digits = e.clipboardData.getData("text").replace(/[^0-9]/g, "");
              if (!digits) return;
              setQty(Math.max(1, Math.min(Number(digits), product.stock)));
            }}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, "");
              if (!digits) return;
              const next = Number(digits);
              if (!Number.isFinite(next)) return;
              setQty(Math.max(1, Math.min(next, product.stock)));
            }}
            className="h-11 w-14 border-x border-border bg-transparent text-center text-sm font-medium [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
            disabled={outOfStock || qty >= product.stock}
            aria-label="Increase quantity"
            className="tap flex h-11 w-11 items-center justify-center rounded-r-lg transition-colors hover:bg-accent disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {savings > 0 && (
          <span className="text-sm text-primary">
            Save {formatPrice(savings)} at {formatPrice(unitPrice)}/vial
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-sm text-muted-foreground">Subtotal</span>
        <span className="text-xl font-bold">{formatPrice(unitPrice * qty)}</span>
      </div>

      <Button onClick={addToCart} disabled={outOfStock} size="lg" className="tap w-full">
        <ShoppingCart className="mr-2 h-4 w-4" />
        {outOfStock ? "Out of stock" : "Add to cart"}
      </Button>
    </div>
  );
}

function TierRow({
  label,
  price,
  active,
  onClick,
}: {
  label: string;
  price: number;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
        onClick && "hover:bg-accent/50",
        active && "bg-primary/10 font-semibold text-primary"
      )}
    >
      <span>{label} vials</span>
      <span>{formatPrice(price)} each</span>
    </button>
  );
}

export default AddToCartPanel;
