import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const forms = await prisma.product.groupBy({ by: ["form"], _count: true });
  const risky = await prisma.product.findMany({
    where: { form: { in: ["SOLUTION", "NASAL_SPRAY", "CAPSULE"] } },
    select: { slug: true, name: true, form: true, active: true },
  });
  console.log("forms", forms);
  console.log("risky", risky);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
