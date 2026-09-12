/*
  Warnings:

  - You are about to drop the column `orderId` on the `InventoryTransaction` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "InventoryTransaction" DROP CONSTRAINT "InventoryTransaction_orderId_fkey";

-- AlterTable
ALTER TABLE "InventoryTransaction" DROP COLUMN "orderId";
