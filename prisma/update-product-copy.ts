import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DESCRIPTIONS: Record<string, string> = {
  "bpc-157":
    "Synthetic pentadecapeptide supplied as lyophilized trifluoroacetate salt. Certified ≥99% purity by HPLC-MS with full COA. Used for chromatography method development, mass spectrometry calibration, and stability studies under controlled laboratory conditions. Requires lyophilization equipment and analytical balance (0.0001g precision) for accurate preparation of analytical standards. Enhanced verification may apply. For Research Use Only.",
  "tb-500":
    "Synthetic thymosin beta-4 fragment supplied as lyophilized trifluoroacetate salt. Certified ≥98% purity by HPLC-MS. Suitable for chromatography method development, mass spectrometry calibration, and in-vitro analytical characterization. Requires analytical balance (0.0001g precision) and appropriate laboratory solvents. Enhanced verification may apply. For Research Use Only.",
  retatrutide:
    "Synthetic triple GIP/GLP-1/glucagon receptor agonist peptide supplied as lyophilized trifluoroacetate salt. Certified ≥99% purity by HPLC-MS with full COA. For chromatography method development, mass spectrometry calibration, and in-vitro receptor binding kinetics. Requires lyophilization equipment and analytical balance (0.0001g precision). Enhanced verification may apply. For Research Use Only.",
  "klow-blend":
    "Multi-peptide analytical standard blend containing KPV, Larazotide, GHK-Cu and BPC-157 in a single 80mg lyophilized vial for combination-study protocols. Certified ≥98% purity by HPLC-MS. Suitable for chromatographic method development and mass spectrometry calibration only. Enhanced verification may apply. For Research Use Only.",
  "glow-blend":
    "Multi-peptide analytical standard blend containing GHK-Cu, BPC-157 and TB-500 in a single 70mg lyophilized vial for combination-study protocols. Certified ≥98% purity by HPLC-MS. Suitable for chromatographic method development and mass spectrometry calibration only. Enhanced verification may apply. For Research Use Only.",
  "wolverine-blend":
    "Multi-peptide analytical standard blend containing BPC-157, TB-500 and GHK-Cu in a single 20mg lyophilized vial for combination-study protocols. Certified ≥98% purity by HPLC-MS. Suitable for chromatographic method development and mass spectrometry calibration only. Enhanced verification may apply. For Research Use Only.",
};

async function main() {
  for (const [slug, description] of Object.entries(DESCRIPTIONS)) {
    const product = await prisma.product.updateMany({
      where: { slug },
      data: { description },
    });
    console.log(`  ${slug}: ${product.count} row(s) updated`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
