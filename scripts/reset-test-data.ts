/**
 * One-shot ops script: clear all orders (restoring stock) and upsert a $1
 * test-vial product for checkout payment tests.
 *
 * Usage: npx tsx scripts/reset-test-data.ts
 */
import { PrismaClient, ProductForm } from "@prisma/client";

const prisma = new PrismaClient();

async function clearOrders() {
  const orders = await prisma.order.findMany({
    include: { items: true },
  });

  const restore = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items) {
      restore.set(item.variantId, (restore.get(item.variantId) ?? 0) + item.quantity);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.emailPaymentNotification.updateMany({
      data: { orderId: null, status: "IGNORED" },
    });
    await tx.campaignEvent.updateMany({ data: { orderId: null } });

    // Cascade deletes OrderItem / Payment / PaymentReceipt.
    const deleted = await tx.order.deleteMany({});

    for (const [variantId, qty] of restore) {
      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: { stock: true, productId: true },
      });
      if (!variant) continue;
      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          stock: variant.stock + qty,
          reserved: 0,
          version: { increment: 1 },
        },
      });
      await tx.inventoryLog.create({
        data: {
          variantId,
          reason: "RETURN",
          delta: qty,
          before: variant.stock,
          after: variant.stock + qty,
          note: "Restored when clearing orders for fresh checkout tests",
        },
      });
    }

    await tx.productVariant.updateMany({ data: { reserved: 0 } });

    console.log(`  ✓ deleted ${deleted.count} orders`);
    console.log(`  ✓ restored stock on ${restore.size} variants`);
  });
}

async function upsertTestVial() {
  const specialty =
    (await prisma.category.findUnique({ where: { slug: "specialty" } })) ??
    (await prisma.category.create({
      data: {
        name: "Specialty",
        slug: "specialty",
        description: "Specialty & test compounds",
        sortOrder: 99,
      },
    }));

  const product = await prisma.product.upsert({
    where: { slug: "test-vial" },
    update: {
      name: "Test Vial",
      description:
        "Internal checkout test product priced at $1. For payment-rail testing only — not a research standard for sale.",
      active: true,
      featured: false,
      highRisk: false,
      researchUse: true,
      purity: ">=99%",
      form: ProductForm.LYOPHILIZED,
      categoryId: specialty.id,
      minPriceCents: 100,
      maxPriceCents: 100,
      inStock: true,
    },
    create: {
      name: "Test Vial",
      slug: "test-vial",
      description:
        "Internal checkout test product priced at $1. For payment-rail testing only — not a research standard for sale.",
      active: true,
      featured: false,
      highRisk: false,
      researchUse: true,
      purity: ">=99%",
      form: ProductForm.LYOPHILIZED,
      categoryId: specialty.id,
      minPriceCents: 100,
      maxPriceCents: 100,
      inStock: true,
      variants: {
        create: {
          sku: "EBL-TEST-1",
          strengthMg: 1,
          priceCents: 100,
          stock: 999,
          active: true,
          sortOrder: 0,
          reconstitutionVolumeMl: 3,
        },
      },
    },
    include: { variants: true },
  });

  const variant =
    product.variants[0] ??
    (await prisma.productVariant.upsert({
      where: { sku: "EBL-TEST-1" },
      update: {
        productId: product.id,
        strengthMg: 1,
        priceCents: 100,
        stock: 999,
        active: true,
      },
      create: {
        productId: product.id,
        sku: "EBL-TEST-1",
        strengthMg: 1,
        priceCents: 100,
        stock: 999,
        active: true,
        sortOrder: 0,
        reconstitutionVolumeMl: 3,
      },
    }));

  if (product.variants[0]) {
    await prisma.productVariant.update({
      where: { id: variant.id },
      data: { priceCents: 100, stock: 999, active: true, strengthMg: 1 },
    });
  }

  console.log(`  ✓ product /products/${product.slug} — $${(100 / 100).toFixed(2)} (sku ${variant.sku})`);
}

async function main() {
  console.log("Resetting checkout test data...");
  await clearOrders();
  await upsertTestVial();
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
