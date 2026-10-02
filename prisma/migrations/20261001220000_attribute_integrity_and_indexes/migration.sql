-- 1. Exclusivity check constraint for AttributeValue (either productId OR variantId, never both, never neither)
ALTER TABLE "AttributeValue" ADD CONSTRAINT "AttributeValue_target_check"
CHECK (
  ("productId" IS NOT NULL AND "variantId" IS NULL) OR
  ("productId" IS NULL AND "variantId" IS NOT NULL)
);

-- 2. Partial unique index for product-level attribute assignments
CREATE UNIQUE INDEX "AttributeValue_product_definition_unique"
ON "AttributeValue"("productId", "definitionId")
WHERE "productId" IS NOT NULL;

-- 3. Partial unique index for variant-level attribute assignments
CREATE UNIQUE INDEX "AttributeValue_variant_definition_unique"
ON "AttributeValue"("variantId", "definitionId")
WHERE "variantId" IS NOT NULL;

-- 4. Case-insensitive unique constraint on global definition names
CREATE UNIQUE INDEX "AttributeDefinition_global_name_unique"
ON "AttributeDefinition"(LOWER("name"))
WHERE "productId" IS NULL;

-- 5. Case-insensitive unique constraint on product-scoped definition names
CREATE UNIQUE INDEX "AttributeDefinition_product_name_unique"
ON "AttributeDefinition"("productId", LOWER("name"))
WHERE "productId" IS NOT NULL;
