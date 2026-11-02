-- AlterEnum: Remove BOTH from AddressType
UPDATE "Address" SET "type" = 'SHIPPING' WHERE "type"::text = 'BOTH';
ALTER TABLE "Address" ALTER COLUMN "type" DROP DEFAULT;
CREATE TYPE "AddressType_new" AS ENUM ('SHIPPING', 'BILLING');
ALTER TABLE "Address" ALTER COLUMN "type" TYPE "AddressType_new" USING ("type"::text::"AddressType_new");
ALTER TYPE "AddressType" RENAME TO "AddressType_old";
ALTER TYPE "AddressType_new" RENAME TO "AddressType";
DROP TYPE "AddressType_old";
ALTER TABLE "Address" ALTER COLUMN "type" SET DEFAULT 'SHIPPING';

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'VOID');

-- CreateEnum
CREATE TYPE "InvoicePdfStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "InvoiceEmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('INTRA_STATE', 'INTER_STATE');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'DEAD_LETTER');

-- AlterTable: Order
ALTER TABLE "Order"
  ADD COLUMN "billingAddressId" TEXT,
  ADD COLUMN "billingAddress" JSONB,
  ADD COLUMN "invoiceIssueError" TEXT;

-- AlterTable: OrderItem
ALTER TABLE "OrderItem"
  ADD COLUMN "originalUnitPrice" DECIMAL(65,30),
  ADD COLUMN "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateTable: InvoiceSequence
CREATE TABLE "InvoiceSequence" (
    "series" TEXT NOT NULL,
    "sellerGstin" VARCHAR(15) NOT NULL,
    "financialYear" VARCHAR(5) NOT NULL,
    "prefix" VARCHAR(3) NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("series")
);

-- CreateTable: Invoice
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" VARCHAR(16) NOT NULL,
    "financialYear" VARCHAR(5) NOT NULL,
    "templateVersion" TEXT NOT NULL DEFAULT 'v1',
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "pdfStatus" "InvoicePdfStatus" NOT NULL DEFAULT 'PENDING',
    "emailStatus" "InvoiceEmailStatus" NOT NULL DEFAULT 'PENDING',
    "taxRegime" "TaxRegime" NOT NULL,
    "sellerGstin" VARCHAR(15) NOT NULL,
    "sellerState" TEXT NOT NULL,
    "sellerStateCode" VARCHAR(2) NOT NULL,
    "placeOfSupplyState" TEXT NOT NULL,
    "placeOfSupplyCode" VARCHAR(2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotalGross" DECIMAL(65,30) NOT NULL,
    "productDiscountTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "subtotalDiscounted" DECIMAL(65,30) NOT NULL,
    "subtotalTaxable" DECIMAL(65,30) NOT NULL,
    "shippingFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "shippingTaxable" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "shippingTax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cgstTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgstTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igstTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(65,30) NOT NULL,
    "customerCode" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "sellerSnapshot" JSONB NOT NULL,
    "billingAddress" JSONB NOT NULL,
    "shippingAddress" JSONB NOT NULL,
    "paymentSnapshot" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storageKey" TEXT,
    "pdfGenerationVersion" INTEGER NOT NULL DEFAULT 1,
    "pdfGeneratedAt" TIMESTAMP(3),
    "pdfAttempts" INTEGER NOT NULL DEFAULT 0,
    "pdfLastError" TEXT,
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailLastError" TEXT,
    "emailLastAttemptAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "emailLastRecipient" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InvoiceItem
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
    "title" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "hsnCode" TEXT,
    "quantity" INTEGER NOT NULL,
    "originalUnitPrice" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "grossAmount" DECIMAL(65,30) NOT NULL,
    "productDiscount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "finalInclusiveAmount" DECIMAL(65,30) NOT NULL,
    "taxableAmount" DECIMAL(65,30) NOT NULL,
    "gstRate" DECIMAL(65,30) NOT NULL,
    "cgstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTax" DECIMAL(65,30) NOT NULL,
    "lineTotal" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InvoiceEmailDelivery
CREATE TABLE "InvoiceEmailDelivery" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "requestedById" TEXT,
    "status" "InvoiceEmailStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceEmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OutboxEvent
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 10,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastError" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSequence_sellerGstin_financialYear_prefix_key" ON "InvoiceSequence"("sellerGstin", "financialYear", "prefix");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE INDEX "Invoice_userId_issuedAt_idx" ON "Invoice"("userId", "issuedAt");

-- CreateIndex
CREATE INDEX "Invoice_status_pdfStatus_idx" ON "Invoice"("status", "pdfStatus");

-- CreateIndex
CREATE INDEX "Invoice_financialYear_issuedAt_idx" ON "Invoice"("financialYear", "issuedAt");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceEmailDelivery_invoiceId_createdAt_idx" ON "InvoiceEmailDelivery"("invoiceId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_nextAttemptAt_idx" ON "OutboxEvent"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_leaseExpiresAt_idx" ON "OutboxEvent"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceEmailDelivery" ADD CONSTRAINT "InvoiceEmailDelivery_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

