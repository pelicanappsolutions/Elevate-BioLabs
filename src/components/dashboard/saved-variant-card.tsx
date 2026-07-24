"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, FlaskConical, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { formatPrice } from "@/lib/utils";
import { useCart } from "@/store/cart";

export interface SavedVariantData {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  strengthMg: number;
  sku: string;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  images: { url: string; alt: string | null }[];
}

// Unlike ProductCard (compound-level, no strength context), a saved item
// knows exactly which strength the user saved — so this keeps a real
// "Add to cart" action instead of routing through "View options".
export function SavedVariantCard({ variant }: { variant: SavedVariantData }) {
  const { toast } = useToast();
  const add = useCart((s) => s.add);
  const image = variant.images[0];
  const outOfStock = variant.stock <= 0;
  const displayName = `${variant.productName} ${variant.strengthMg}mg`;

  function handleAddToCart() {
    if (outOfStock) return;
    add({
      variantId: variant.variantId,
      productId: variant.productId,
      slug: variant.productSlug,
      name: displayName,
      sku: variant.sku,
      imageUrl: image?.url,
      priceCents: variant.priceCents,
      maxStock: variant.stock,
    });
    toast({ title: "Added to cart", description: displayName });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
      <Link
        href={`/products/${variant.productSlug}`}
        className="relative block aspect-square w-full shrink-0 overflow-hidden bg-secondary"
      >
        {image ? (
          <Image
            src={image.url}
            alt={image.alt ?? displayName}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-secondary to-background">
            <FlaskConical className="h-10 w-10 text-primary/60" aria-hidden="true" />
          </div>
        )}
        {outOfStock && (
          <Badge variant="secondary" className="absolute left-2 top-2">
            Out of stock
          </Badge>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/products/${variant.productSlug}`} className="tap">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary sm:text-base">
            {displayName}
          </h3>
        </Link>
        <p className="text-xs text-muted-foreground">SKU {variant.sku}</p>

        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-base font-semibold sm:text-lg">
            {formatPrice(variant.priceCents)}
          </span>
          {variant.compareAtCents != null && variant.compareAtCents > variant.priceCents && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(variant.compareAtCents)}
            </span>
          )}
        </div>

        {!outOfStock && (
          <span className="inline-flex items-center gap-1 text-xs text-primary">
            <Check className="h-3.5 w-3.5" />
            In stock
          </span>
        )}

        <Button onClick={handleAddToCart} disabled={outOfStock} size="sm" className="mt-1 w-full">
          <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
          {outOfStock ? "Out of stock" : "Add to cart"}
        </Button>
      </div>
    </div>
  );
}

export default SavedVariantCard;
