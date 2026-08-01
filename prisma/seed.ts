import { PrismaClient, ProductForm } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Elevate Bio-Labs...");

  // ---- Admin user ----
  const adminPassword = await bcrypt.hash("Admin123!change-me", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@elevatebiolab.com" },
    update: {},
    create: {
      email: "admin@elevatebiolab.com",
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
    { name: "Specialty", slug: "specialty", description: "Specialty & melanocortin research compounds" },
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

  interface SeedVariant {
    sku: string;
    strengthMg: number;
    priceCents: number;
    compareAtCents?: number;
    stock: number;
    /** Path under /public. Omit to fall back to PLACEHOLDER_IMAGE. */
    image?: string;
    /** Standard analytical dilution reference volume for concentration calculations. */
    reconstitutionVolumeMl?: number;
  }

  interface SeedCompound {
    slug: string;
    name: string;
    cas?: string;
    purity?: string;
    molarMass?: number;
    sequence?: string;
    form: ProductForm;
    category: string;
    featured?: boolean;
    highRisk?: boolean;
    description: string;
    storageInfo?: string;
    variants: SeedVariant[];
  }

  // ---- Compounds, each with the strength options standard in the
  // research-peptide industry (not just whatever happened to be seeded first). ----
  const compounds: SeedCompound[] = [
    {
      slug: "semaglutide", name: "Semaglutide",
      cas: "910463-68-2", purity: ">=99%", molarMass: 4113.6,
      form: ProductForm.LYOPHILIZED, category: "metabolic", featured: true,
      sequence: "HAEGTFTSDVSSYLEGQAAKEFIAWLVKGRG (GLP-1 analog)",
      description: "Synthetic GLP-1 receptor agonist peptide supplied as lyophilized trifluoroacetate salt. Certified ≥99% purity by HPLC-MS with full COA. Intended for chromatography method development, mass spectrometry calibration, and in-vitro receptor binding kinetics. Requires lyophilization equipment and an analytical balance (0.0001g precision) for accurate preparation of analytical standards. For Research Use Only — not for human or veterinary consumption.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-SEMA-5", strengthMg: 5, priceCents: 8999, compareAtCents: 10999, stock: 120 },
        { sku: "EBL-SEMA-10", strengthMg: 10, priceCents: 14999, stock: 90 },
      ],
    },
    {
      slug: "tirzepatide", name: "Tirzepatide",
      cas: "2023788-19-2", purity: ">=99%", molarMass: 4813.5,
      form: ProductForm.LYOPHILIZED, category: "metabolic", featured: true,
      description: "Synthetic dual GIP/GLP-1 receptor agonist peptide supplied as lyophilized trifluoroacetate salt. Certified ≥99% purity by HPLC-MS. Suitable for chromatography method development, mass spectrometry calibration, and in-vitro receptor binding studies. Requires analytical balance (0.0001g precision) and appropriate laboratory solvent handling. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-TIRZ-10", strengthMg: 10, priceCents: 10000, stock: 80, image: "/images/products/tirzepatide-10mg.png" },
        { sku: "EBL-TIRZ-20", strengthMg: 20, priceCents: 18000, stock: 60, image: "/images/products/tirzepatide-20mg.png" },
        { sku: "EBL-TIRZ-30", strengthMg: 30, priceCents: 30999, stock: 40 },
      ],
    },
    {
      slug: "retatrutide", name: "Retatrutide",
      cas: "2381089-83-2", purity: ">=99%",
      form: ProductForm.LYOPHILIZED, category: "metabolic", highRisk: true,
      description: "Synthetic triple GIP/GLP-1/glucagon receptor agonist peptide supplied as lyophilized trifluoroacetate salt. Certified ≥99% purity by HPLC-MS with full COA. For chromatography method development, mass spectrometry calibration, and in-vitro receptor binding kinetics. Requires lyophilization equipment and analytical balance (0.0001g precision). Enhanced verification may apply. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-RETA-5", strengthMg: 5, priceCents: 8999, stock: 90, image: "/images/products/retatrutide-5mg.png" },
        { sku: "EBL-RETA-10", strengthMg: 10, priceCents: 10000, stock: 75, image: "/images/products/retatrutide-10mg.png" },
        { sku: "EBL-RETA-15", strengthMg: 15, priceCents: 15000, stock: 65 },
        { sku: "EBL-RETA-20", strengthMg: 20, priceCents: 18000, stock: 50, image: "/images/products/retatrutide-20mg.png" },
        { sku: "EBL-RETA-30", strengthMg: 30, priceCents: 22000, stock: 40, image: "/images/products/retatrutide-30mg.png" },
      ],
    },
    {
      slug: "ghk-cu", name: "GHK-Cu",
      cas: "89030-95-5", purity: ">=99%", molarMass: 403.9,
      sequence: "Gly-His-Lys (Cu²⁺ complex)",
      form: ProductForm.LYOPHILIZED, category: "recovery-repair", featured: true,
      description: "Copper tripeptide-1 (Gly-His-Lys copper complex) supplied as characteristic blue lyophilized powder. Certified ≥99% purity by HPLC-MS. Suitable for chromatography method development, mass spectrometry calibration, and extracellular-matrix research applications. Requires analytical balance (0.0001g precision) and copper-compatible laboratory solvents. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-GHKCU-50", strengthMg: 50, priceCents: 6000, stock: 130, image: "/images/products/ghk-cu-50mg.png" },
        { sku: "EBL-GHKCU-100", strengthMg: 100, priceCents: 9999, stock: 85 },
      ],
    },
    {
      slug: "nad-plus", name: "NAD+",
      cas: "53-84-9", purity: ">=99%", molarMass: 663.4,
      form: ProductForm.LYOPHILIZED, category: "longevity", featured: true,
      description: "Nicotinamide adenine dinucleotide (NAD⁺), a coenzyme central to redox and cellular-energy research, supplied as lyophilized powder in an amber vial to limit light exposure. Certified ≥99% purity by HPLC-MS. Suitable for chromatography method development, mass spectrometry calibration, and enzymatic assay development. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-NAD-300", strengthMg: 300, priceCents: 6999, stock: 110 },
        { sku: "EBL-NAD-500", strengthMg: 500, priceCents: 6000, stock: 100, image: "/images/products/nad-plus-500mg.png", reconstitutionVolumeMl: 5 },
        { sku: "EBL-NAD-1000", strengthMg: 1000, priceCents: 10000, stock: 60, reconstitutionVolumeMl: 10 },
      ],
    },
    {
      slug: "klow-blend", name: "KLOW Blend",
      purity: ">=99%",
      form: ProductForm.BLEND, category: "blends", featured: true, highRisk: true,
      description: "Multi-peptide analytical standard blend containing KPV, Larazotide, GHK-Cu and BPC-157 in a single 80mg lyophilized vial for combination-study protocols. Certified ≥99% purity by HPLC-MS. Suitable for chromatographic method development and mass spectrometry calibration only. Enhanced verification may apply. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      // Blend — "80mg" describes the total formulation, not an interchangeable
      // strength choice, so this stays a single-variant compound.
      variants: [
        { sku: "EBL-KLOW-80", strengthMg: 80, priceCents: 18999, stock: 55, image: "/images/products/klow-blend-80mg.png" },
      ],
    },
    {
      slug: "glow-blend", name: "GLOW Blend",
      purity: ">=99%",
      form: ProductForm.BLEND, category: "blends", featured: true, highRisk: true,
      description: "Multi-peptide analytical standard blend containing GHK-Cu, BPC-157 and TB-500 in a single 70mg lyophilized vial for combination-study protocols. Certified ≥99% purity by HPLC-MS. Suitable for chromatographic method development and mass spectrometry calibration only. Enhanced verification may apply. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-GLOW-70", strengthMg: 70, priceCents: 9000, stock: 65, image: "/images/products/glow-blend-70mg.png" },
      ],
    },
    {
      slug: "bpc-157", name: "BPC-157",
      cas: "137525-51-0", purity: ">=99%",
      form: ProductForm.LYOPHILIZED, category: "recovery-repair", featured: true, highRisk: true,
      description: "Synthetic pentadecapeptide supplied as lyophilized trifluoroacetate salt. Certified ≥99% purity by HPLC-MS with full COA. Used for chromatography method development, mass spectrometry calibration, and stability studies under controlled laboratory conditions. Requires lyophilization equipment and analytical balance (0.0001g precision) for accurate preparation of analytical standards. Enhanced verification may apply. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-BPC-5", strengthMg: 5, priceCents: 4499, stock: 200 },
        { sku: "EBL-BPC-10", strengthMg: 10, priceCents: 5000, stock: 150 },
      ],
    },
    {
      slug: "tb-500", name: "TB-500",
      cas: "77591-33-4", purity: ">=99%",
      form: ProductForm.LYOPHILIZED, category: "recovery-repair", highRisk: true,
      description: "Synthetic thymosin beta-4 fragment supplied as lyophilized trifluoroacetate salt. Certified ≥99% purity by HPLC-MS. Suitable for chromatography method development, mass spectrometry calibration, and in-vitro analytical characterization. Requires analytical balance (0.0001g precision) and appropriate laboratory solvents. Enhanced verification may apply. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-TB500-5", strengthMg: 5, priceCents: 4999, stock: 150 },
        { sku: "EBL-TB500-10", strengthMg: 10, priceCents: 5500, stock: 110 },
      ],
    },
    {
      slug: "ipamorelin", name: "Ipamorelin",
      cas: "170851-70-4", purity: ">=99%",
      form: ProductForm.LYOPHILIZED, category: "growth-hormone",
      description: "Synthetic pentapeptide (Aib-His-D-2-Nal-D-Phe-Lys-NH₂) selective ghrelin receptor agonist supplied as lyophilized trifluoroacetate salt. Certified ≥99% purity by HPLC-MS. Suitable for chromatography method development, mass spectrometry calibration, and in-vitro receptor binding studies. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-IPAM-2", strengthMg: 2, priceCents: 1999, stock: 190 },
        { sku: "EBL-IPAM-5", strengthMg: 5, priceCents: 3999, stock: 175 },
        { sku: "EBL-IPAM-10", strengthMg: 10, priceCents: 5000, stock: 120 },
      ],
    },
    {
      slug: "cjc-1295", name: "CJC-1295 no-DAC",
      cas: "863288-34-0", purity: ">=99%",
      form: ProductForm.LYOPHILIZED, category: "growth-hormone",
      description: "Synthetic GHRH analog (Tyr-D-Ala-Asp-Ala-Ile-Phe-Thr-Gln-Ser-Tyr-Arg-Lys-Val-Leu-Ala-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Met-Ser-Arg-NH₂) supplied as lyophilized trifluoroacetate salt. Certified ≥99% purity by HPLC-MS. Suitable for chromatography method development, mass spectrometry calibration, and in-vitro receptor binding studies. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-CJC-2", strengthMg: 2, priceCents: 3499, stock: 140 },
        { sku: "EBL-CJC-5", strengthMg: 5, priceCents: 6999, stock: 100 },
        { sku: "EBL-CJC-10", strengthMg: 10, priceCents: 5000, stock: 90 },
      ],
    },
    {
      slug: "semax", name: "Semax",
      cas: "80714-61-0", purity: ">=99%",
      form: ProductForm.NASAL_SPRAY, category: "cognitive",
      description: "Synthetic heptapeptide (Met-Glu-His-Phe-Pro-Gly-Pro) supplied as buffered aqueous analytical reference formulation. Certified ≥99% purity by HPLC-MS. Suitable for chromatography method development, mass spectrometry calibration, and in-vitro analytical studies. For Research Use Only.",
      storageInfo: "Refrigerate formulation at 2–8°C, protected from light. Do not freeze. Stable for 12 months under recommended conditions.",
      variants: [
        { sku: "EBL-SEMAX-10", strengthMg: 10, priceCents: 5000, stock: 120 },
        { sku: "EBL-SEMAX-30", strengthMg: 30, priceCents: 5499, stock: 90 },
      ],
    },
    {
      slug: "selank", name: "Selank",
      cas: "129954-34-3", purity: ">=99%",
      form: ProductForm.NASAL_SPRAY, category: "cognitive",
      description: "Synthetic tuftsin analog peptide (Thr-Lys-Pro-Arg-Pro-Gly-Pro) supplied as buffered aqueous analytical reference formulation. Certified ≥99% purity by HPLC-MS. Suitable for chromatography method development, mass spectrometry calibration, and in-vitro analytical studies. For Research Use Only.",
      storageInfo: "Refrigerate formulation at 2–8°C, protected from light. Do not freeze. Stable for 12 months under recommended conditions.",
      variants: [
        { sku: "EBL-SELANK-5", strengthMg: 5, priceCents: 2999, stock: 130 },
        { sku: "EBL-SELANK-10", strengthMg: 10, priceCents: 5000, stock: 110 },
      ],
    },
    {
      slug: "mots-c", name: "MOTS-c",
      purity: ">=99%",
      form: ProductForm.LYOPHILIZED, category: "metabolic",
      description: "Mitochondrial-derived peptide (MRWQEMGYIFYPRKLR) supplied as lyophilized trifluoroacetate salt. Certified ≥99% purity by HPLC-MS. Suitable for chromatography method development, mass spectrometry calibration, and in-vitro metabolic research. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-MOTSC-20", strengthMg: 20, priceCents: 6000, stock: 100 },
        { sku: "EBL-MOTSC-40", strengthMg: 40, priceCents: 10000, stock: 70 },
      ],
    },
    {
      slug: "sermorelin", name: "Sermorelin",
      cas: "86168-78-7", purity: ">=99%", molarMass: 3357.9,
      form: ProductForm.LYOPHILIZED, category: "growth-hormone",
      description: "Synthetic GHRH(1-29) analog (Tyr-Ala-Asp-Ala-Ile-Phe-Thr-Asn-Ser-Tyr-Arg-Lys-Val-Leu-Gly-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Met-Ser-Arg) supplied as lyophilized trifluoroacetate salt. Certified ≥99% purity by HPLC-MS. Suitable for chromatography method development, mass spectrometry calibration, and in-vitro receptor binding studies. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-SERM-5", strengthMg: 5, priceCents: 5000, stock: 130 },
      ],
    },
    {
      slug: "tesamorelin", name: "Tesamorelin",
      cas: "218949-48-5", purity: ">=99%", molarMass: 5135.9,
      form: ProductForm.LYOPHILIZED, category: "growth-hormone",
      description: "Synthetic stabilized GHRH analog supplied as lyophilized trifluoroacetate salt. Certified ≥99% purity by HPLC-MS. Suitable for chromatography method development, mass spectrometry calibration, and in-vitro receptor binding studies. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-TESA-10", strengthMg: 10, priceCents: 7000, stock: 100 },
      ],
    },
    {
      slug: "tesa-ipa-blend", name: "Tesamorelin/Ipamorelin Blend",
      purity: ">=99%",
      form: ProductForm.BLEND, category: "blends",
      description: "Multi-peptide analytical standard blend containing Tesamorelin and Ipamorelin (5mg/5mg) in a single 10mg lyophilized vial for combination-study protocols. Certified ≥99% purity by HPLC-MS. Suitable for chromatographic method development and mass spectrometry calibration only. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-TI-10", strengthMg: 10, priceCents: 7500, stock: 80 },
      ],
    },
    {
      slug: "tesa-ipa-cjc-blend", name: "Tesamorelin/Ipamorelin/CJC-1295 Blend",
      purity: ">=99%",
      form: ProductForm.BLEND, category: "blends",
      description: "Multi-peptide analytical standard blend containing Tesamorelin, Ipamorelin and CJC-1295 no-DAC (6mg/3mg/3mg) in a single 12mg lyophilized vial for combination-study protocols. Certified ≥99% purity by HPLC-MS. Suitable for chromatographic method development and mass spectrometry calibration only. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-TIC-12", strengthMg: 12, priceCents: 8500, stock: 70 },
      ],
    },
    {
      slug: "wolverine-blend", name: "Wolverine Blend",
      purity: ">=99%",
      form: ProductForm.BLEND, category: "blends", highRisk: true,
      description: "Multi-peptide analytical standard blend containing BPC-157, TB-500 and GHK-Cu in a single 20mg lyophilized vial for combination-study protocols. Certified ≥99% purity by HPLC-MS. Suitable for chromatographic method development and mass spectrometry calibration only. Enhanced verification may apply. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-WOLV-20", strengthMg: 20, priceCents: 8500, stock: 75 },
      ],
    },
    {
      slug: "glutathione", name: "Glutathione",
      cas: "70-18-8", purity: ">=99%", molarMass: 307.3,
      form: ProductForm.LYOPHILIZED, category: "longevity",
      description: "γ-L-Glutamyl-L-cysteinyl-glycine tripeptide antioxidant supplied as lyophilized powder. Certified ≥99% purity by HPLC-MS. Suitable for chromatography method development, mass spectrometry calibration, and redox biology research. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-GLUT-1500", strengthMg: 1500, priceCents: 4500, stock: 110, reconstitutionVolumeMl: 5 },
      ],
    },
    {
      slug: "l-carnitine", name: "L-Carnitine",
      cas: "541-15-1", purity: ">=99%", molarMass: 161.2,
      form: ProductForm.LYOPHILIZED, category: "metabolic",
      description: "(R)-3-hydroxy-4-(trimethylammonio)butanoate amino-acid derivative supplied as lyophilized powder. Certified ≥99% purity by HPLC-MS. Suitable for chromatography method development, mass spectrometry calibration, and fatty-acid metabolism research. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-LCAR-1200", strengthMg: 1200, priceCents: 4500, stock: 100, reconstitutionVolumeMl: 5 },
      ],
    },
    {
      slug: "melanotan-2", name: "Melanotan-2",
      cas: "121062-08-6", purity: ">=99%", molarMass: 1024.2,
      form: ProductForm.LYOPHILIZED, category: "specialty",
      description: "Synthetic melanocortin receptor agonist peptide (Ac-Nle-c[Asp-His-D-Phe-Arg-Trp-Lys]-NH₂) supplied as lyophilized trifluoroacetate salt. Certified ≥99% purity by HPLC-MS. Suitable for chromatography method development, mass spectrometry calibration, and in-vitro receptor binding studies. For Research Use Only.",
      storageInfo: "Store lyophilized powder at -20°C, protected from light and moisture. Stable as supplied for 24 months under recommended conditions.",
      variants: [
        { sku: "EBL-MT2-10", strengthMg: 10, priceCents: 6000, stock: 90 },
      ],
    },
  ];

  let variantCount = 0;
  let variantsWithPhotos = 0;

  for (const c of compounds) {
    const { category, variants, ...compoundData } = c;

    const product = await prisma.product.upsert({
      where: { slug: c.slug },
      update: { ...compoundData, categoryId: catMap[category] },
      create: {
        ...compoundData,
        categoryId: catMap[category],
      },
    });

    for (const [i, v] of variants.entries()) {
      const { image, ...variantData } = v;

      const variant = await prisma.productVariant.upsert({
        where: { sku: v.sku },
        // Price/strength can change without a new SKU — re-apply on every run.
        // Stock is intentionally excluded: it's managed via inventoryLogs below.
        update: {
          strengthMg: v.strengthMg,
          priceCents: v.priceCents,
          compareAtCents: v.compareAtCents ?? null,
          reconstitutionVolumeMl: v.reconstitutionVolumeMl ?? 3,
          sortOrder: i,
        },
        create: {
          ...variantData,
          productId: product.id,
          sortOrder: i,
          coas: {
            create: [
              {
                batchLot: `LOT-${v.sku}-2026A`,
                fileUrl: "/sample-coa.pdf",
                purity: c.purity,
                testedOn: new Date("2026-01-15"),
              },
            ],
          },
        },
      });

      // Re-sync price tiers on every run: prices change without a new SKU.
      await prisma.priceTier.deleteMany({ where: { variantId: variant.id } });
      await prisma.priceTier.createMany({
        data: [
          { variantId: variant.id, minQty: 5, unitPriceCents: Math.round(v.priceCents * 0.92) },
          { variantId: variant.id, minQty: 10, unitPriceCents: Math.round(v.priceCents * 0.85) },
        ],
      });

      // Re-sync the photo on every run: the upsert above intentionally leaves
      // existing variants alone, so images would otherwise stay stale when new
      // artwork lands.
      await prisma.productImage.deleteMany({ where: { variantId: variant.id } });
      await prisma.productImage.create({
        data: {
          variantId: variant.id,
          url: image ?? PLACEHOLDER_IMAGE,
          alt: `${c.name} ${v.strengthMg}mg analytical standard`,
          sortOrder: 0,
        },
      });
      if (image) variantsWithPhotos++;

      // Seed stock only once — re-running shouldn't stack phantom restock rows.
      const loggedAlready = await prisma.inventoryLog.count({
        where: { variantId: variant.id },
      });
      if (loggedAlready === 0) {
        await prisma.inventoryLog.create({
          data: {
            variantId: variant.id,
            reason: "RESTOCK",
            delta: v.stock,
            before: 0,
            after: v.stock,
            note: "Initial seed stock",
          },
        });
      }
      variantCount++;
    }

    // Denormalized catalog aggregates — recomputed from this compound's
    // variants, same logic recomputeProductAggregates() applies at runtime.
    const activePrices = variants.map((v) => v.priceCents);
    const anyInStock = variants.some((v) => v.stock > 0);
    await prisma.product.update({
      where: { id: product.id },
      data: {
        minPriceCents: Math.min(...activePrices),
        maxPriceCents: Math.max(...activePrices),
        inStock: anyInStock,
      },
    });
  }

  console.log(
    `  ✓ ${compounds.length} compounds / ${variantCount} variants (${variantsWithPhotos} with product photos), tiers, COAs`
  );

  // ---- Compliance docs ----
  const docs = [
    {
      title: "Research Use Only Policy", slug: "ruo-policy", category: "RUO",
      body: "All products sold by Elevate Bio-Labs are intended for research use only as analytical standards and laboratory reagents. They are not drugs, foods, cosmetics, or dietary supplements, and are not FDA-approved for the diagnosis, treatment, cure, or prevention of any disease. They are not for human or veterinary consumption. By purchasing, you certify you are a qualified researcher aged 18+ operating appropriate analytical equipment (HPLC, LC-MS, or equivalent).",
    },
    {
      title: "Shipping Policy", slug: "shipping-policy", category: "SHIPPING_POLICY",
      body: "Orders ship via USPS with tracking. Analytical standards are packed in plain exterior packaging with no product names or claims visible. COA and MSDS documentation are included inside. No bacteriostatic water, injection supplies, or reconstitution instructions are included. We ship within the United States only.",
    },
    {
      title: "Return & Refund Policy", slug: "refund-policy", category: "REFUND",
      body: "Due to the research-grade nature of our analytical standards, all sales are final once shipped. Damaged or incorrect items are eligible for replacement within 7 days with photo proof. We do not provide dosing, reconstitution, or sample-preparation guidance.",
    },
    {
      title: "Terms of Sale", slug: "terms-of-sale", category: "TERMS",
      body: "By placing an order, you represent that you are at least 18 years old, operate a laboratory equipped for analytical work, and are purchasing reference standards for lawful in-vitro research only. These materials are not for human or veterinary consumption, diagnosis, or treatment. Misrepresentation of laboratory status, resale for human or veterinary use, or use inconsistent with their RUO labeling is a breach of these terms and may result in order cancellation and account closure. We reserve the right to cancel any order we believe is destined for non-research use.\n\nOrder-related email: When you place an order you agree we may email the contact address you provide at checkout with transactional messages about that order — including order confirmation, payment instructions or payment received notices, shipping/tracking updates, and support related to the purchase. These messages are required to fulfill your order and are separate from optional marketing emails. You cannot opt out of transactional order email while an order is open; you may unsubscribe from marketing emails at any time.",
    },
    {
      title: "Privacy Policy", slug: "privacy-policy", category: "PRIVACY",
      body: "We collect information needed to process orders, verify laboratory status, fulfill shipments, and support your account. This includes your name, email address, phone number, shipping address, order history, payment references, and verification documents.\n\nTransactional order email: The email you enter at checkout is stored with your order so we can send order confirmation, payment status, shipping/tracking, and customer-support messages about that purchase. These transactional messages are not marketing and do not require a separate marketing opt-in.\n\nMarketing email: If you opt in at checkout, via the newsletter form, or in account settings, we may send research updates, new batch announcements, and occasional offers. Marketing messages include an unsubscribe link. Opting out of marketing does not stop transactional order emails.\n\nWe do not sell your personal information. We use cookies and similar technologies to keep your cart and session working. For questions about your data, contact info@elevatebiolab.com. We comply with applicable U.S. privacy laws and will notify users of any material changes to this policy.",
    },
    {
      title: "LegitScript Compliance", slug: "legitscript", category: "LEGITSCRIPT",
      body: "Elevate Bio-Labs maintains RUO labeling, batch/lot COA traceability, independent-laboratory verification for non-institutional buyers, and monitors chargeback ratios against the 2026 Visa VAMP 1.5% threshold to preserve processing eligibility.",
    },
  ];
  for (const d of docs) {
    await prisma.complianceDoc.upsert({
      where: { slug: d.slug },
      update: { title: d.title, category: d.category, body: d.body },
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
