"use client";

import * as React from "react";
import Image from "next/image";
import { FlaskConical } from "lucide-react";

import { cn } from "@/lib/utils";

interface GalleryImage {
  id: string;
  url: string;
  alt?: string | null;
}

export function ProductGallery({
  images,
  productName,
}: {
  images: GalleryImage[];
  productName: string;
}) {
  const [active, setActive] = React.useState(0);

  // Guards both an empty gallery and an index that outran the array.
  const current = images[active] ?? images[0];

  if (!current) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-border bg-gradient-to-br from-primary/15 via-secondary to-background">
        <FlaskConical className="h-16 w-16 text-primary/50" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-secondary">
        <Image
          src={current.url}
          alt={current.alt ?? productName}
          fill
          // The LCP element on this route — eager-load it and let Next serve
          // the right size per breakpoint.
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label={`${productName} images`}
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`View image ${i + 1} of ${images.length}`}
              onClick={() => setActive(i)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors sm:h-20 sm:w-20",
                i === active ? "border-primary" : "border-border hover:border-primary/40"
              )}
            >
              <Image
                src={img.url}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductGallery;
