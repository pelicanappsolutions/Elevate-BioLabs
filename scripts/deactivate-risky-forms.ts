/**
 * Deactivate storefront products whose form implies ready-to-use / administration
 * (premixed solution, capsule, nasal spray) — FDA RUO risk.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RISKY = ["SOLUTION", "NASAL_SPRAY", "CAPSULE"] as const;

async function main() {
  const result = await prisma.product.updateMany({
    where: { form: { in: [...RISKY] } },
    data: { active: false, featured: false },
  });
  const left = await prisma.product.findMany({
    where: { form: { in: [...RISKY] } },
    select: { slug: true, name: true, form: true, active: true },
  });
  console.log(`Deactivated ${result.count} product(s).`);
  console.log(left);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
