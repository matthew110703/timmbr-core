-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'STAFF';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "acknowledgedById" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "OrderActivity" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "staffId" TEXT,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "updateCategory" TEXT,
    "isCustomerVisible" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderNotificationDelivery" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "recipient" TEXT NOT NULL,
    "status" "InvoiceEmailStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderNotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderActivity_idempotencyKey_key" ON "OrderActivity"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OrderActivity_orderId_createdAt_idx" ON "OrderActivity"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderActivity_orderId_eventType_idx" ON "OrderActivity"("orderId", "eventType");

-- CreateIndex
CREATE INDEX "OrderActivity_orderId_isCustomerVisible_createdAt_idx" ON "OrderActivity"("orderId", "isCustomerVisible", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderNotificationDelivery_activityId_key" ON "OrderNotificationDelivery"("activityId");

-- CreateIndex
CREATE INDEX "OrderNotificationDelivery_orderId_createdAt_idx" ON "OrderNotificationDelivery"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderNotificationDelivery_status_idx" ON "OrderNotificationDelivery"("status");

-- CreateIndex
CREATE INDEX "Order_status_acknowledgedAt_idx" ON "Order"("status", "acknowledgedAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderActivity" ADD CONSTRAINT "OrderActivity_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderActivity" ADD CONSTRAINT "OrderActivity_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderNotificationDelivery" ADD CONSTRAINT "OrderNotificationDelivery_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "OrderActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
