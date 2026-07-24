"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, Loader2 } from "lucide-react";

import { toggleSavedProduct } from "@/actions/dashboard";
import { SavedVariantCard, type SavedVariantData } from "@/components/dashboard/saved-variant-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface SavedItem {
  id: string;
  variant: SavedVariantData;
}

export function SavedProducts({ items }: { items: SavedItem[] }) {
  const { toast } = useToast();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function unsave(variantId: string, name: string) {
    setPendingId(variantId);
    try {
      const res = await toggleSavedProduct(variantId);
      if (res.ok) toast({ title: "Removed", description: `${name} unsaved.` });
    } finally {
      setPendingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <Heart className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold">Nothing saved yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Save compounds you order often for one-tap reordering.
        </p>
        <Button asChild className="mt-4">
          <Link href="/products">Browse catalog</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col gap-2">
          <SavedVariantCard variant={item.variant} />
          <Button
            variant="ghost"
            size="sm"
            disabled={pendingId === item.variant.variantId}
            onClick={() =>
              unsave(item.variant.variantId, `${item.variant.productName} ${item.variant.strengthMg}mg`)
            }
            className="text-muted-foreground hover:text-destructive"
          >
            {pendingId === item.variant.variantId ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Heart className="mr-1.5 h-3.5 w-3.5 fill-current" />
            )}
            Unsave
          </Button>
        </div>
      ))}
    </div>
  );
}

export default SavedProducts;
