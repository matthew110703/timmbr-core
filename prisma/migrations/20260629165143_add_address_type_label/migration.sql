-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('SHIPPING', 'BILLING', 'BOTH');

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "label" TEXT NOT NULL DEFAULT 'home',
ADD COLUMN     "type" "AddressType" NOT NULL DEFAULT 'SHIPPING',
ALTER COLUMN "isDefault" SET DEFAULT false,
ALTER COLUMN "latitude" DROP NOT NULL,
ALTER COLUMN "longitude" DROP NOT NULL;
