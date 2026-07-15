"use client";

import Image from "next/image";
import Link from "next/link";
import { FlaskConical, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { formatPrice } from "@/lib/utils";
import { useCart } from "@/store/cart";

export interface ProductCardProduct {
  id: string;
  slug: string;
  name: string;
  sku: string;
  priceCents: number;
  compareAtCents?: number | null;
  purity?: string | null;
  cas?: string | null;
  form: string;
  stock: number;
  images?: { url: string; alt?: string | null }[];
}

const LOW_STOCK_THRESHOLD = 10;

export function ProductCard({ product }: { product: ProductCardProduct }) {
  const { toast } = useToast();
  const add = useCart((s) => s.add);

  const image = product.images?.[0];
  const isOutOfStock = product.stock === 0;
  const isLowStock = !isOutOfStock && product.stock <= LOW_STOCK_THRESHOLD;

  function handleAddToCart() {
    if (isOutOfStock) return;
    add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      imageUrl: image?.url,
      priceCents: product.priceCents,
      maxStock: product.stock,
    });
    toast({
      title: "Added to cart",
      description: `${product.name} (${product.sku})`,
    });
  }

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
        {isLowStock && (
          <Badge variant="destructive" className="absolute left-2 top-2">
            Low stock
          </Badge>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1.5">
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

        <p className="text-xs text-muted-foreground">SKU {product.sku}</p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold sm:text-lg">
              {formatPrice(product.priceCents)}
            </span>
            {product.compareAtCents != null && product.compareAtCents > product.priceCents && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.compareAtCents)}
              </span>
            )}
          </div>
        </div>

        <Button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          className="mt-1 w-full"
        >
          <ShoppingCart className="mr-1.5 h-4 w-4" />
          {isOutOfStock ? "Out of stock" : "Add to cart"}
        </Button>
      </div>
    </div>
  );
}

export default ProductCard;
