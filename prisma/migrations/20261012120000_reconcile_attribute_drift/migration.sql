-- Reconcile AttributeValue/AttributeDefinition with what dev and staging actually have.
-- Some databases were built partly outside migrations, so every statement is idempotent.

-- 1. A value belongs to exactly one product or variant (the CHECK below), so deleting
--    its owner must delete the value: SET NULL would violate the CHECK.
ALTER TABLE "AttributeValue" DROP CONSTRAINT IF EXISTS "AttributeValue_productId_fkey";
ALTER TABLE "AttributeValue" ADD CONSTRAINT "AttributeValue_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttributeValue" DROP CONSTRAINT IF EXISTS "AttributeValue_variantId_fkey";
ALTER TABLE "AttributeValue" ADD CONSTRAINT "AttributeValue_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. One name for the target check (some databases have it lower-cased).
ALTER TABLE "AttributeValue" DROP CONSTRAINT IF EXISTS "attribute_value_target_check";
ALTER TABLE "AttributeValue" DROP CONSTRAINT IF EXISTS "AttributeValue_target_check";
ALTER TABLE "AttributeValue" ADD CONSTRAINT "AttributeValue_target_check"
CHECK (
  ("productId" IS NOT NULL AND "variantId" IS NULL) OR
  ("productId" IS NULL AND "variantId" IS NOT NULL)
);

-- 3. Foreign-key indexes (now declared in the schema).
CREATE INDEX IF NOT EXISTS "AttributeDefinition_productId_idx" ON "AttributeDefinition"("productId");
CREATE INDEX IF NOT EXISTS "AttributeValue_definitionId_idx" ON "AttributeValue"("definitionId");
CREATE INDEX IF NOT EXISTS "AttributeValue_productId_idx" ON "AttributeValue"("productId");
CREATE INDEX IF NOT EXISTS "AttributeValue_variantId_idx" ON "AttributeValue"("variantId");

-- 4. Low-cardinality indexes that no query uses.
DROP INDEX IF EXISTS "AttributeDefinition_scope_idx";
DROP INDEX IF EXISTS "AttributeDefinition_isFilterable_idx";
