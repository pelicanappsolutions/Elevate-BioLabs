import { PrismaClient, ProductForm } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Elevate Bio-Labs...");

  // ---- Admin user ----
  const adminPassword = await bcrypt.hash("Admin123!change-me", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@elevatebiolabs.com" },
    update: {},
    create: {
      email: "admin@elevatebiolabs.com",
      name: "Lab Admin",
      role: "ADMIN",
      passwordHash: adminPassword,
      emailVerified: new Date(),
      ageVerified: true,
    },
  });
  console.log("  ✓ admin:", admin.email, "(password: Admin123!change-me)");

  // ---- Categories ----
  const categories = [
    { name: "Metabolic", slug: "metabolic", description: "GLP-1 & metabolic research peptides" },
    { name: "Recovery & Repair", slug: "recovery-repair", description: "Tissue repair and recovery" },
    { name: "Growth Hormone", slug: "growth-hormone", description: "GH secretagogues" },
    { name: "Cognitive", slug: "cognitive", description: "Nootropic research peptides" },
    { name: "Blends", slug: "blends", description: "Multi-peptide research blends" },
    { name: "Longevity", slug: "longevity", description: "Cellular & longevity research compounds" },
  ];
  const catMap: Record<string, string> = {};
  for (const [i, c] of categories.entries()) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, sortOrder: i },
    });
    catMap[c.slug] = cat.id;
  }
  console.log(`  ✓ ${categories.length} categories`);

  // Product photography lives in /public/images/products (served at /images/...).
  // Anything without a real photo falls back to a stock placeholder.
  const PLACEHOLDER_IMAGE =
    "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=80";

  interface SeedProduct {
    sku: string;
    name: string;
    slug: string;
    /** Path under /public. Omit to fall back to PLACEHOLDER_IMAGE. */
    image?: string;
    cas?: string;
    purity?: string;
    molarMass?: number;
    sequence?: string;
    priceCents: number;
    compareAtCents?: number;
    stock: number;
    form: ProductForm;
    category: string;
    featured?: boolean;
    description: string;
    storageInfo?: string;
  }

  // ---- Products ----
  const products: SeedProduct[] = [
    {
      sku: "EBL-SEMA-5", name: "Semaglutide 5mg", slug: "semaglutide-5mg",
      cas: "910463-68-2", purity: ">=99%", molarMass: 4113.6, priceCents: 8999,
      compareAtCents: 10999, stock: 120, form: ProductForm.LYOPHILIZED,
      category: "metabolic", featured: true,
      sequence: "HAEGT...(GLP-1 analog)",
      description: "Semaglutide is a GLP-1 receptor agonist studied for metabolic research applications. Lyophilized powder, reconstitute with bacteriostatic water. For Research Use Only — not for human consumption.",
      storageInfo: "Store lyophilized at -20°C. After reconstitution, refrigerate 2–8°C and use within 30 days.",
    },
    {
      sku: "EBL-TIRZ-10", name: "Tirzepatide 10mg", slug: "tirzepatide-10mg",
      image: "/images/products/tirzepatide-10mg.png",
      cas: "2023788-19-2", purity: ">=99%", molarMass: 4813.5, priceCents: 13999,
      stock: 80, form: ProductForm.LYOPHILIZED, category: "metabolic", featured: true,
      description: "Dual GIP/GLP-1 receptor agonist for metabolic research. Lyophilized. For Research Use Only.",
      storageInfo: "Store at -20°C. Reconstitute with bacteriostatic water; refrigerate after mixing.",
    },
    {
      sku: "EBL-TIRZ-20", name: "Tirzepatide 20mg", slug: "tirzepatide-20mg",
      image: "/images/products/tirzepatide-20mg.png",
      cas: "2023788-19-2", purity: ">=99%", molarMass: 4813.5, priceCents: 22999,
      stock: 60, form: ProductForm.LYOPHILIZED, category: "metabolic", featured: true,
      description: "Dual GIP/GLP-1 receptor agonist for metabolic research, supplied as a 20mg lyophilized vial for extended study protocols. For Research Use Only.",
      storageInfo: "Store at -20°C. Reconstitute with bacteriostatic water; refrigerate after mixing.",
    },
    {
      sku: "EBL-RETA-5", name: "Retatrutide 5mg", slug: "retatrutide-5mg",
      image: "/images/products/retatrutide-5mg.png",
      cas: "2381089-83-2", purity: ">=99%", priceCents: 8999,
      stock: 90, form: ProductForm.LYOPHILIZED, category: "metabolic",
      description: "Triple GIP/GLP-1/glucagon receptor agonist studied in metabolic research. Lyophilized powder. For Research Use Only.",
      storageInfo: "Store lyophilized at -20°C. After reconstitution, refrigerate 2–8°C and use within 30 days.",
    },
    {
      sku: "EBL-RETA-10", name: "Retatrutide 10mg", slug: "retatrutide-10mg",
      image: "/images/products/retatrutide-10mg.png",
      cas: "2381089-83-2", purity: ">=99%", priceCents: 14999,
      stock: 75, form: ProductForm.LYOPHILIZED, category: "metabolic", featured: true,
      description: "Triple GIP/GLP-1/glucagon receptor agonist studied in metabolic research. Lyophilized powder. For Research Use Only.",
      storageInfo: "Store lyophilized at -20°C. After reconstitution, refrigerate 2–8°C and use within 30 days.",
    },
    {
      sku: "EBL-RETA-20", name: "Retatrutide 20mg", slug: "retatrutide-20mg",
      image: "/images/products/retatrutide-20mg.png",
      cas: "2381089-83-2", purity: ">=99%", priceCents: 24999,
      stock: 50, form: ProductForm.LYOPHILIZED, category: "metabolic",
      description: "Triple GIP/GLP-1/glucagon receptor agonist studied in metabolic research, supplied as a 20mg lyophilized vial. For Research Use Only.",
      storageInfo: "Store lyophilized at -20°C. After reconstitution, refrigerate 2–8°C and use within 30 days.",
    },
    {
      sku: "EBL-RETA-30", name: "Retatrutide 30mg", slug: "retatrutide-30mg",
      image: "/images/products/retatrutide-30mg.png",
      cas: "2381089-83-2", purity: ">=99%", priceCents: 32999, compareAtCents: 37999,
      stock: 40, form: ProductForm.LYOPHILIZED, category: "metabolic",
      description: "Triple GIP/GLP-1/glucagon receptor agonist studied in metabolic research, supplied as a 30mg lyophilized vial for extended study protocols. For Research Use Only.",
      storageInfo: "Store lyophilized at -20°C. After reconstitution, refrigerate 2–8°C and use within 30 days.",
    },
    {
      sku: "EBL-GHKCU-50", name: "GHK-Cu 50mg", slug: "ghk-cu-50mg",
      image: "/images/products/ghk-cu-50mg.png",
      cas: "89030-95-5", purity: ">=99%", molarMass: 403.9,
      sequence: "Gly-His-Lys (Cu²⁺ complex)", priceCents: 5999,
      stock: 130, form: ProductForm.LYOPHILIZED, category: "recovery-repair", featured: true,
      description: "Copper tripeptide-1 (Gly-His-Lys copper complex) studied in tissue-remodelling and extracellular-matrix research. Characteristic blue lyophilate. For Research Use Only.",
      storageInfo: "Store lyophilized at -20°C, protected from light. Refrigerate 2–8°C after reconstitution.",
    },
    {
      sku: "EBL-NAD-500", name: "NAD+ 500mg", slug: "nad-plus-500mg",
      image: "/images/products/nad-plus-500mg.png",
      cas: "53-84-9", purity: ">=99%", molarMass: 663.4, priceCents: 9999,
      stock: 100, form: ProductForm.LYOPHILIZED, category: "longevity", featured: true,
      description: "Nicotinamide adenine dinucleotide, a coenzyme central to redox and cellular-energy research. Supplied in an amber vial to limit light exposure. For Research Use Only.",
      storageInfo: "Store lyophilized at -20°C, protected from light. Refrigerate 2–8°C after reconstitution and use within 14 days.",
    },
    {
      sku: "EBL-KLOW-80", name: "KLOW Blend 80mg", slug: "klow-blend-80mg",
      image: "/images/products/klow-blend-80mg.png",
      purity: ">=98%", priceCents: 18999,
      stock: 55, form: ProductForm.BLEND, category: "blends", featured: true,
      description: "Multi-peptide research blend combining KPV, Larazotide, GHK-Cu and BPC-157 in a single 80mg lyophilized vial for combination-study protocols. For Research Use Only.",
      storageInfo: "Store lyophilized at -20°C, protected from light. Refrigerate 2–8°C after reconstitution.",
    },
    {
      sku: "EBL-GLOW-70", name: "GLOW Blend 70mg", slug: "glow-blend-70mg",
      image: "/images/products/glow-blend-70mg.png",
      purity: ">=98%", priceCents: 16999,
      stock: 65, form: ProductForm.BLEND, category: "blends", featured: true,
      description: "Multi-peptide research blend combining GHK-Cu, BPC-157 and TB-500 in a single 70mg lyophilized vial for combination-study protocols. For Research Use Only.",
      storageInfo: "Store lyophilized at -20°C, protected from light. Refrigerate 2–8°C after reconstitution.",
    },
    {
      sku: "EBL-BPC-5", name: "BPC-157 5mg", slug: "bpc-157-5mg",
      cas: "137525-51-0", purity: ">=99%", priceCents: 4499, stock: 200,
      form: ProductForm.LYOPHILIZED, category: "recovery-repair", featured: true,
      description: "Body Protection Compound-157, a pentadecapeptide studied in tissue-repair research. For Research Use Only.",
      storageInfo: "Store lyophilized at -20°C, protect from light.",
    },
    {
      sku: "EBL-TB500-5", name: "TB-500 5mg", slug: "tb-500-5mg",
      cas: "77591-33-4", purity: ">=98%", priceCents: 4999, stock: 150,
      form: ProductForm.LYOPHILIZED, category: "recovery-repair",
      description: "Thymosin Beta-4 fragment studied for recovery research. For Research Use Only.",
      storageInfo: "Store at -20°C.",
    },
    {
      sku: "EBL-IPAM-5", name: "Ipamorelin 5mg", slug: "ipamorelin-5mg",
      cas: "170851-70-4", purity: ">=99%", priceCents: 3999, stock: 175,
      form: ProductForm.LYOPHILIZED, category: "growth-hormone",
      description: "Selective GH secretagogue / ghrelin receptor agonist. For Research Use Only.",
      storageInfo: "Store at -20°C.",
    },
    {
      sku: "EBL-CJC-2", name: "CJC-1295 no-DAC 2mg", slug: "cjc-1295-2mg",
      cas: "863288-34-0", purity: ">=99%", priceCents: 3499, stock: 140,
      form: ProductForm.LYOPHILIZED, category: "growth-hormone",
      description: "GHRH analog studied alongside GH secretagogues. For Research Use Only.",
      storageInfo: "Store at -20°C.",
    },
    {
      sku: "EBL-SEMAX-30", name: "Semax 30mg", slug: "semax-30mg",
      cas: "80714-61-0", purity: ">=98%", priceCents: 5499, stock: 90,
      form: ProductForm.NASAL_SPRAY, category: "cognitive",
      description: "Heptapeptide studied in cognitive research. For Research Use Only.",
      storageInfo: "Refrigerate 2–8°C.",
    },
    {
      sku: "EBL-SELANK-10", name: "Selank 10mg", slug: "selank-10mg",
      cas: "129954-34-3", purity: ">=98%", priceCents: 4999, stock: 110,
      form: ProductForm.NASAL_SPRAY, category: "cognitive",
      description: "Synthetic analog of tuftsin studied in cognitive research. For Research Use Only.",
      storageInfo: "Refrigerate 2–8°C.",
    },
  ];

  for (const p of products) {
    const { category, image, ...data } = p;
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        ...data,
        categoryId: catMap[category],
        priceTiers: {
          create: [
            { minQty: 5, unitPriceCents: Math.round(p.priceCents * 0.92) },
            { minQty: 10, unitPriceCents: Math.round(p.priceCents * 0.85) },
          ],
        },
        coas: {
          create: [
            {
              batchLot: `LOT-${p.sku}-2026A`,
              fileUrl: "/sample-coa.pdf",
              purity: p.purity,
              testedOn: new Date("2026-01-15"),
            },
          ],
        },
      },
    });

    // Re-sync the photo on every run: the upsert above intentionally leaves
    // existing products alone, so images would otherwise stay stale when new
    // artwork lands.
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: image ?? PLACEHOLDER_IMAGE,
        alt: p.name,
        sortOrder: 0,
      },
    });

    // Seed stock only once — re-running shouldn't stack phantom restock rows.
    const loggedAlready = await prisma.inventoryLog.count({
      where: { productId: product.id },
    });
    if (loggedAlready === 0) {
      await prisma.inventoryLog.create({
        data: {
          productId: product.id,
          reason: "RESTOCK",
          delta: p.stock,
          before: 0,
          after: p.stock,
          note: "Initial seed stock",
        },
      });
    }
  }
  const withPhotos = products.filter((p) => p.image).length;
  console.log(
    `  ✓ ${products.length} products (${withPhotos} with product photos), tiers, COAs`
  );

  // ---- Compliance docs ----
  const docs = [
    {
      title: "Research Use Only Policy", slug: "ruo-policy", category: "RUO",
      body: "All products sold by Elevate Bio-Labs are intended FOR RESEARCH USE ONLY (RUO). They are not drugs, foods, cosmetics, or dietary supplements, and are NOT FDA-approved for the diagnosis, treatment, cure, or prevention of any disease. They are not for human or veterinary consumption. By purchasing, you certify you are a qualified researcher aged 18+.",
    },
    {
      title: "Shipping Policy", slug: "shipping-policy", category: "SHIPPING_POLICY",
      body: "Orders ship via USPS with tracking. Temperature-sensitive items ship with cold packs. Delivery timelines and RUO labeling apply to all shipments.",
    },
    {
      title: "Return & Refund Policy", slug: "refund-policy", category: "REFUND",
      body: "Due to the research-grade nature of our products, all sales are final once shipped. Damaged or incorrect items are eligible for replacement within 7 days with photo proof.",
    },
    {
      title: "LegitScript Compliance", slug: "legitscript", category: "LEGITSCRIPT",
      body: "Elevate Bio-Labs maintains RUO labeling, batch/lot COA traceability, and monitors chargeback ratios against the 2026 Visa VAMP 1.5% threshold to preserve processing eligibility.",
    },
  ];
  for (const d of docs) {
    await prisma.complianceDoc.upsert({
      where: { slug: d.slug },
      update: {},
      create: d,
    });
  }
  console.log(`  ✓ ${docs.length} compliance docs`);

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
