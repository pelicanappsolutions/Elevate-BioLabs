/**
 * Reset password for admin emails.
 * Usage:
 *   ADMIN_RESET_PASSWORD='YourNewPass1!' npx tsx scripts/reset-admin-password.ts
 * Optional:
 *   ADMIN_RESET_EMAILS='info@elevatebiolab.com,admin@elevatebiolab.com'
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const password = process.env.ADMIN_RESET_PASSWORD?.trim();
  if (!password || password.length < 10) {
    throw new Error("Set ADMIN_RESET_PASSWORD to a strong password (10+ chars).");
  }

  const emails = (process.env.ADMIN_RESET_EMAILS ??
    "admin@elevatebiolab.com,info@elevatebiolab.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const passwordHash = await bcrypt.hash(password, 10);

  for (const email of emails) {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`skip (not found): ${email}`);
      continue;
    }
    await db.user.update({
      where: { email },
      data: { passwordHash, role: "ADMIN", ageVerified: true },
    });
    console.log(`reset OK: ${email}`);
  }

  console.log("Done. Change the password after login if this was temporary.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
