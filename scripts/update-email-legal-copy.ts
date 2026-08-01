import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TERMS = `By placing an order, you represent that you are at least 18 years old, operate a laboratory equipped for analytical work, and are purchasing reference standards for lawful in-vitro research only. These materials are not for human or veterinary consumption, diagnosis, or treatment. Misrepresentation of laboratory status, resale for human or veterinary use, or use inconsistent with their RUO labeling is a breach of these terms and may result in order cancellation and account closure. We reserve the right to cancel any order we believe is destined for non-research use.

Order-related email: When you place an order you agree we may email the contact address you provide at checkout with transactional messages about that order — including order confirmation, payment instructions or payment received notices, shipping/tracking updates, and support related to the purchase. These messages are required to fulfill your order and are separate from optional marketing emails. You cannot opt out of transactional order email while an order is open; you may unsubscribe from marketing emails at any time.`;

const PRIVACY = `We collect information needed to process orders, verify laboratory status, fulfill shipments, and support your account. This includes your name, email address, phone number, shipping address, order history, payment references, and verification documents.

Transactional order email: The email you enter at checkout is stored with your order so we can send order confirmation, payment status, shipping/tracking, and customer-support messages about that purchase. These transactional messages are not marketing and do not require a separate marketing opt-in.

Marketing email: If you opt in at checkout, via the newsletter form, or in account settings, we may send research updates, new batch announcements, and occasional offers. Marketing messages include an unsubscribe link. Opting out of marketing does not stop transactional order emails.

We do not sell your personal information. We use cookies and similar technologies to keep your cart and session working. For questions about your data, contact info@elevatebiolab.com. We comply with applicable U.S. privacy laws and will notify users of any material changes to this policy.`;

async function main() {
  await prisma.complianceDoc.update({
    where: { slug: "terms-of-sale" },
    data: { body: TERMS },
  });
  await prisma.complianceDoc.update({
    where: { slug: "privacy-policy" },
    data: { body: PRIVACY },
  });
  console.log("Updated TERMS + PRIVACY compliance docs");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
