"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

const FORMS = [
  { value: "LYOPHILIZED", label: "Lyophilized powder" },
  { value: "SOLUTION", label: "Pre-mixed solution" },
  { value: "CAPSULE", label: "Capsule" },
  { value: "BLEND", label: "Blend" },
  { value: "NASAL_SPRAY", label: "Nasal spray" },
];

export function ProductFilters({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);

  // Price inputs are local state so typing doesn't refetch on every keystroke;
  // they commit to the URL on Apply.
  const [minPrice, setMinPrice] = React.useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = React.useState(searchParams.get("maxPrice") ?? "");

  const activeCategory = searchParams.get("category");
  const activeForm = searchParams.get("form");
  const inStockOnly = searchParams.get("inStock") === "1";

  const activeCount =
    (activeCategory ? 1 : 0) +
    (activeForm ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (searchParams.get("minPrice") || searchParams.get("maxPrice") ? 1 : 0);

  /** Every filter write resets pagination — page 3 of the old result set is
   *  meaningless once the filter changes. */
  const setParam = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  function clearAll() {
    setMinPrice("");
    setMaxPrice("");
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    if (q) params.set("q", q); // keep the search term, drop the refinements
    router.push(params.toString() ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  }

  const panel = (
    <div className="flex flex-col gap-6">
      {/* Category */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Category</legend>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setParam({ category: null })}
            className={cn(
              "tap flex items-center rounded-md px-2 text-left text-sm transition-colors hover:bg-accent/50",
              !activeCategory && "bg-accent/60 font-medium text-accent-foreground"
            )}
          >
            All categories
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                setParam({ category: activeCategory === c.slug ? null : c.slug })
              }
              className={cn(
                "tap flex items-center rounded-md px-2 text-left text-sm transition-colors hover:bg-accent/50",
                activeCategory === c.slug &&
                  "bg-accent/60 font-medium text-accent-foreground"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Form */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Form</legend>
        <div className="flex flex-col gap-1">
          {FORMS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setParam({ form: activeForm === f.value ? null : f.value })}
              className={cn(
                "tap flex items-center rounded-md px-2 text-left text-sm transition-colors hover:bg-accent/50",
                activeForm === f.value &&
                  "bg-accent/60 font-medium text-accent-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Price */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Price (USD)</legend>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Label htmlFor="minPrice" className="sr-only">
              Minimum price
            </Label>
            <Input
              id="minPrice"
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </div>
          <span className="text-muted-foreground">–</span>
          <div className="flex-1">
            <Label htmlFor="maxPrice" className="sr-only">
              Maximum price
            </Label>
            <Input
              id="maxPrice"
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 w-full"
          onClick={() => setParam({ minPrice: minPrice || null, maxPrice: maxPrice || null })}
        >
          Apply price
        </Button>
      </fieldset>

      {/* Availability */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Availability</legend>
        <div className="flex items-center gap-2">
          <Checkbox
            id="inStock"
            checked={inStockOnly}
            onCheckedChange={(checked) => setParam({ inStock: checked ? "1" : null })}
          />
          <Label htmlFor="inStock" className="cursor-pointer text-sm font-normal">
            In stock only
          </Label>
        </div>
      </fieldset>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="justify-start">
          <X className="mr-1.5 h-4 w-4" />
          Clear all filters
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile: collapsible disclosure so filters never eat the viewport */}
      <div className="lg:hidden">
        <Button
          variant="outline"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="filter-panel"
          className="tap w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </span>
          {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
        </Button>
        {open && (
          <div
            id="filter-panel"
            className="mt-3 rounded-lg border border-border bg-card p-4"
          >
            {panel}
          </div>
        )}
      </div>

      {/* Desktop: sticky rail */}
      <aside className="hidden lg:block">
        <div className="sticky top-8 rounded-lg border border-border bg-card p-4">
          {panel}
        </div>
      </aside>
    </>
  );
}

export default ProductFilters;
