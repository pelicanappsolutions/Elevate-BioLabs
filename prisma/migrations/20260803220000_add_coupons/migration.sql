-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED_CENTS');

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL,
    "percentOff" INTEGER,
    "amountOffCents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "minSubtotalCents" INTEGER NOT NULL DEFAULT 0,
    "affiliateName" TEXT,
    "affiliateEmail" TEXT,
    "affiliateNote" TEXT,
    "commissionPercent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "code" TEXT NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "orderSubtotalCents" INTEGER NOT NULL,
    "orderTotalCents" INTEGER NOT NULL,
    "commissionCents" INTEGER NOT NULL DEFAULT 0,
    "affiliateName" TEXT,
    "affiliateEmail" TEXT,
    "paidOut" BOOLEAN NOT NULL DEFAULT false,
    "paidOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "couponCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "couponId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Coupon_active_idx" ON "Coupon"("active");
CREATE INDEX "Coupon_affiliateEmail_idx" ON "Coupon"("affiliateEmail");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");
CREATE INDEX "CouponRedemption_affiliateEmail_idx" ON "CouponRedemption"("affiliateEmail");
CREATE INDEX "CouponRedemption_paidOut_idx" ON "CouponRedemption"("paidOut");
CREATE INDEX "CouponRedemption_createdAt_idx" ON "CouponRedemption"("createdAt");

-- CreateIndex
CREATE INDEX "Order_couponId_idx" ON "Order"("couponId");
CREATE INDEX "Order_couponCode_idx" ON "Order"("couponCode");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
