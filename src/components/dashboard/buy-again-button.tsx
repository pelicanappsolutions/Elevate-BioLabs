"use client";

import * as React from "react";
import { Loader2, RotateCcw } from "lucide-react";

import { getReorderPayload } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useCart } from "@/store/cart";

export function BuyAgainButton({
  orderId,
  size = "sm",
  variant = "outline",
}: {
  orderId: string;
  size?: "sm" | "default" | "lg";
  variant?: "outline" | "default" | "ghost";
}) {
  const { toast } = useToast();
  const add = useCart((s) => s.add);
  const [busy, setBusy] = React.useState(false);

  async function reorder() {
    setBusy(true);
    try {
      const res = await getReorderPayload(orderId);
      if (!res.ok) {
        toast({ title: "Couldn't reorder", description: res.error, variant: "destructive" });
        return;
      }
      if (res.items.length === 0) {
        toast({
          title: "Nothing available to reorder",
          description: "Every item from this order is out of stock or discontinued.",
          variant: "destructive",
        });
        return;
      }
      res.items.forEach((i) => add({ ...i, imageUrl: i.imageUrl ?? undefined }));
      toast({
        title: `Added ${res.items.length} item${res.items.length === 1 ? "" : "s"} to cart`,
        description: res.skipped.length
          ? `${res.skipped.length} item${res.skipped.length === 1 ? " was" : "s were"} skipped (unavailable).`
          : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size={size} variant={variant} onClick={reorder} disabled={busy}>
      {busy ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
      )}
      Buy again
    </Button>
  );
}

export default BuyAgainButton;
