"use server";

import { z } from "zod";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { variantDisplayName } from "@/lib/utils";

const lookupSchema = z.object({
  batchLot: z.string().min(2).max(64),
});

export interface CoaLookupResult {
  batchLot: string;
  fileUrl: string;
  purity: string | null;
  testedOn: string | null;
  productName: string;
  productSlug: string;
}

/**
 * Public batch/lot -> COA lookup for the compliance page. Read-only and
 * unauthenticated by design (customers verify a vial before they buy), so it's
 * rate-limited per-batch to keep it from being used to enumerate the catalog.
 */
export async function lookupBatch(
  input: unknown
): Promise<{ ok: true; results: CoaLookupResult[] } | { ok: false; error: string }> {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid batch or lot number." };

  const rl = rateLimit(`coa-lookup:${parsed.data.batchLot}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.success) return { ok: false, error: "Too many lookups. Try again shortly." };

  const coas = await db.cOA.findMany({
    where: {
      OR: [
        { batchLot: { contains: parsed.data.batchLot, mode: "insensitive" } },
        { variant: { product: { name: { contains: parsed.data.batchLot, mode: "insensitive" } } } },
      ],
    },
    include: { variant: { include: { product: { select: { name: true, slug: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    ok: true,
    results: coas.map((c) => ({
      batchLot: c.batchLot,
      fileUrl: c.fileUrl,
      purity: c.purity,
      testedOn: c.testedOn ? c.testedOn.toISOString() : null,
      productName: variantDisplayName(c.variant.product.name, c.variant.strengthMg),
      productSlug: c.variant.product.slug,
    })),
  };
}
