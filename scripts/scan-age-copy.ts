import { PrismaClient } from "@prisma/client";

const AGE_18 = /18\+|18 years|at least 18|18 or older|aged 18|I am 18|must be 18/gi;
const AGE_21 = /21\+|21 years|at least 21|21 or older|aged 21|I am 21|must be 21/gi;

const db = new PrismaClient();

async function main() {
  const docs = await db.complianceDoc.findMany({
    select: { slug: true, category: true, title: true, body: true, active: true },
  });
  console.log(`complianceDoc rows: ${docs.length}`);
  let bad = 0;
  for (const d of docs) {
    const hits18 = d.body.match(AGE_18) ?? [];
    const hits21 = d.body.match(AGE_21) ?? [];
    if (hits18.length) bad += 1;
    console.log(
      JSON.stringify({
        slug: d.slug,
        category: d.category,
        active: d.active,
        hits18,
        hits21,
      })
    );
  }
  if (bad) {
    console.error(`FAIL: ${bad} doc(s) still mention 18+ age language`);
    process.exitCode = 1;
  } else {
    console.log("OK: no 18+ age language in ComplianceDoc bodies");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
