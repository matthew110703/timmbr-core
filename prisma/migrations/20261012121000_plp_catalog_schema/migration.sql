-- PLP: attribute vocabulary (options), globally unique category slugs, listing read model, missing indexes.

-- Trigram search on listing titles.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "FilterDisplay" AS ENUM ('CHECKBOX', 'SWATCH', 'TOGGLE');
-- AlterEnum
ALTER TYPE "AttributeType" ADD VALUE 'BOOLEAN';
-- AlterTable
ALTER TABLE "AttributeDefinition" ADD COLUMN     "displayType" "FilterDisplay" NOT NULL DEFAULT 'CHECKBOX',
ADD COLUMN     "filterOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "key" TEXT;
-- CreateTable
CREATE TABLE "AttributeOption" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "swatchHex" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttributeOption_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "AttributeValueOption" (
    "attributeValueId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    CONSTRAINT "AttributeValueOption_pkey" PRIMARY KEY ("attributeValueId","optionId")
);
-- CreateTable
CREATE TABLE "ProductListing" (
    "productId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brandId" TEXT,
    "brandName" TEXT,
    "categoryId" TEXT NOT NULL,
    "categoryPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price" DECIMAL(12,2) NOT NULL,
    "compareAtPrice" DECIMAL(12,2),
    "currency" TEXT NOT NULL,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "hasMultipleVariants" BOOLEAN NOT NULL DEFAULT false,
    "inStock" BOOLEAN NOT NULL DEFAULT false,
    "coverImageKey" TEXT,
    "coverAlt" TEXT,
    "optionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductListing_pkey" PRIMARY KEY ("productId")
);
-- CreateIndex
CREATE UNIQUE INDEX "AttributeOption_definitionId_slug_key" ON "AttributeOption"("definitionId", "slug");
-- CreateIndex
CREATE INDEX "AttributeValueOption_optionId_idx" ON "AttributeValueOption"("optionId");
-- CreateIndex
CREATE INDEX "ProductListing_categoryPath_idx" ON "ProductListing" USING GIN ("categoryPath");
-- CreateIndex
CREATE INDEX "ProductListing_optionIds_idx" ON "ProductListing" USING GIN ("optionIds");
-- CreateIndex
CREATE INDEX "ProductListing_title_trgm_idx" ON "ProductListing" USING GIN ("title" gin_trgm_ops);
-- CreateIndex
CREATE INDEX "ProductListing_price_asc_idx" ON "ProductListing"("inStock" DESC, "price", "productId");
-- CreateIndex
CREATE INDEX "ProductListing_price_desc_idx" ON "ProductListing"("inStock" DESC, "price" DESC, "productId");
-- CreateIndex
CREATE INDEX "ProductListing_newest_idx" ON "ProductListing"("inStock" DESC, "createdAt" DESC, "productId");
-- CreateIndex
CREATE INDEX "ProductListing_discount_idx" ON "ProductListing"("inStock" DESC, "discountPct" DESC, "productId");
-- CreateIndex
CREATE INDEX "ProductListing_brandId_idx" ON "ProductListing"("brandId");
-- CreateIndex
-- Category slugs become globally unique (URLs are /category/<slug>). Rename any duplicates
-- to <slug>-<first 8 chars of id> (cannot collide), keeping the oldest on the plain slug.
WITH ranked AS (
  SELECT id, slug, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY "createdAt", id) AS n FROM "Category"
)
UPDATE "Category" c SET slug = r.slug || '-' || substr(r.id, 1, 8) FROM ranked r WHERE c.id = r.id AND r.n > 1;
DROP INDEX IF EXISTS "Category_parentId_slug_key";
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");
-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");
-- CreateIndex
CREATE INDEX "ProductImage_productId_isPrimary_sortOrder_idx" ON "ProductImage"("productId", "isPrimary", "sortOrder");
-- CreateIndex
CREATE INDEX "ProductVariant_productId_status_idx" ON "ProductVariant"("productId", "status");
-- AddForeignKey
ALTER TABLE "AttributeOption" ADD CONSTRAINT "AttributeOption_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AttributeValueOption" ADD CONSTRAINT "AttributeValueOption_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "AttributeValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AttributeValueOption" ADD CONSTRAINT "AttributeValueOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "AttributeOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ProductListing" ADD CONSTRAINT "ProductListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One default variant per product. Keep the oldest default if a product has several.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "productId" ORDER BY "createdAt", id) AS n
  FROM "ProductVariant" WHERE "isDefault"
)
UPDATE "ProductVariant" v SET "isDefault" = false FROM ranked r WHERE v.id = r.id AND r.n > 1;
CREATE UNIQUE INDEX "ProductVariant_one_default_per_product"
ON "ProductVariant"("productId") WHERE "isDefault";

-- Filter keys are unique among global definitions (partial: Prisma can't express it).
CREATE UNIQUE INDEX "AttributeDefinition_global_key_unique"
ON "AttributeDefinition"("key") WHERE "productId" IS NULL AND "key" IS NOT NULL;

-- Only global definitions can be filters now; product-specific ones stay as spec rows.
UPDATE "AttributeDefinition" SET "isFilterable" = false WHERE "productId" IS NOT NULL;
