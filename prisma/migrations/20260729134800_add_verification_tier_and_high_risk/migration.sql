-- CreateEnum
CREATE TYPE "VerificationTier" AS ENUM ('INSTITUTIONAL', 'INDEPENDENT', 'PENDING');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "verificationTier" "VerificationTier" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "LabProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "labName" TEXT NOT NULL,
    "einOrRegistration" TEXT NOT NULL,
    "street1" TEXT NOT NULL,
    "street2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "researchApplication" TEXT NOT NULL,
    "equipmentCertified" BOOLEAN NOT NULL DEFAULT false,
    "certificationText" TEXT,
    "signedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabProfile_userId_key" ON "LabProfile"("userId");

-- AddForeignKey
ALTER TABLE "LabProfile" ADD CONSTRAINT "LabProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "highRisk" BOOLEAN NOT NULL DEFAULT false;
