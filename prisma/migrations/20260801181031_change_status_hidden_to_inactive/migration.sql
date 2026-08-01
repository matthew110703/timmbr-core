/*
  Warnings:

  - The values [HIDDEN] on the enum `BrandStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [HIDDEN] on the enum `CategoryStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BrandStatus_new" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
ALTER TABLE "public"."Brand" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Brand" ALTER COLUMN "status" TYPE "BrandStatus_new" USING ("status"::text::"BrandStatus_new");
ALTER TYPE "BrandStatus" RENAME TO "BrandStatus_old";
ALTER TYPE "BrandStatus_new" RENAME TO "BrandStatus";
DROP TYPE "public"."BrandStatus_old";
ALTER TABLE "Brand" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "CategoryStatus_new" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
ALTER TABLE "public"."Category" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Category" ALTER COLUMN "status" TYPE "CategoryStatus_new" USING ("status"::text::"CategoryStatus_new");
ALTER TYPE "CategoryStatus" RENAME TO "CategoryStatus_old";
ALTER TYPE "CategoryStatus_new" RENAME TO "CategoryStatus";
DROP TYPE "public"."CategoryStatus_old";
ALTER TABLE "Category" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;
