/*
  Warnings:

  - The values [OUT_OF_STOCK] on the enum `VariantStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('RECEIPT', 'SALE', 'RETURN', 'DAMAGE', 'LOSS', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT');

-- AlterEnum
BEGIN;
CREATE TYPE "VariantStatus_new" AS ENUM ('ACTIVE', 'DISCONTINUED', 'HIDDEN');
ALTER TABLE "public"."ProductVariant" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ProductVariant" ALTER COLUMN "status" TYPE "VariantStatus_new" USING ("status"::text::"VariantStatus_new");
ALTER TYPE "VariantStatus" RENAME TO "VariantStatus_old";
ALTER TYPE "VariantStatus_new" RENAME TO "VariantStatus";
DROP TYPE "public"."VariantStatus_old";
ALTER TABLE "ProductVariant" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantityBefore" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
