-- CreateTable
CREATE TABLE "EmailPaymentNotification" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "rawBody" TEXT NOT NULL,
    "amountCents" INTEGER,
    "orderNumber" TEXT,
    "memo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "orderId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailPaymentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailPaymentNotification_messageId_key" ON "EmailPaymentNotification"("messageId");

-- CreateIndex
CREATE INDEX "EmailPaymentNotification_orderNumber_idx" ON "EmailPaymentNotification"("orderNumber");

-- CreateIndex
CREATE INDEX "EmailPaymentNotification_status_idx" ON "EmailPaymentNotification"("status");

-- CreateIndex
CREATE INDEX "EmailPaymentNotification_messageId_idx" ON "EmailPaymentNotification"("messageId");

-- AddForeignKey
ALTER TABLE "EmailPaymentNotification" ADD CONSTRAINT "EmailPaymentNotification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
