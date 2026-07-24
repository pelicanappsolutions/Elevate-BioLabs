import Image from "next/image";
import Link from "next/link";
import { FlaskConical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";

export interface ProductCardProduct {
  id: string;
  slug: string;
  name: string;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  inStock: boolean;
  variantCount: number;
  purity?: string | null;
  cas?: string | null;
  form: string;
  images?: { url: string; alt?: string | null }[];
}

// No strength context exists on a card (catalog grid, related, homepage
// featured, dashboard saved-products all reuse this) — the shopper picks a
// specific mg strength on the product page instead, so this stays a plain
// server-rendered link rather than an add-to-cart action.
export function ProductCard({ product }: { product: ProductCardProduct }) {
  const image = product.images?.[0];
  const isOutOfStock = !product.inStock;
  const priceRange =
    product.minPriceCents != null && product.maxPriceCents != null
      ? product.minPriceCents === product.maxPriceCents
        ? formatPrice(product.minPriceCents)
        : `From ${formatPrice(product.minPriceCents)}`
      : null;

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-square w-full shrink-0 overflow-hidden bg-secondary"
      >
        {image ? (
          <Image
            src={image.url}
            alt={image.alt ?? product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-secondary to-background">
            <FlaskConical className="h-10 w-10 text-primary/60" aria-hidden="true" />
          </div>
        )}

        {isOutOfStock && (
          <Badge variant="secondary" className="absolute left-2 top-2">
            Out of stock
          </Badge>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="font-normal text-muted-foreground">
            RUO
          </Badge>
          {product.purity && (
            <Badge variant="success" className="font-normal">
              {product.purity} purity
            </Badge>
          )}
          {product.cas && (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              CAS {product.cas}
            </Badge>
          )}
        </div>

        <Link href={`/products/${product.slug}`} className="tap">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug transition-colors group-hover:text-primary sm:text-base">
            {product.name}
          </h3>
        </Link>

        <p className="text-xs text-muted-foreground">
          {product.variantCount} strength{product.variantCount === 1 ? "" : "s"} available
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div className="flex items-baseline gap-2">
            {priceRange && (
              <span className="text-base font-semibold sm:text-lg">{priceRange}</span>
            )}
          </div>
        </div>

        <Button asChild disabled={isOutOfStock} className="mt-1 w-full">
          <Link href={`/products/${product.slug}`}>
            {isOutOfStock ? "Out of stock" : "View options"}
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default ProductCard;
