-- The listing read model stores filter options as small integer codes instead of text ids:
-- int arrays are ~5x smaller and much faster to unnest and count, which keeps facet counting
-- fast on large categories.

-- DropIndex
DROP INDEX "ProductListing_optionIds_idx";

-- AttributeOption gets a compact integer code (existing rows are numbered by the sequence).
ALTER TABLE "AttributeOption" ADD COLUMN "code" SERIAL NOT NULL;
CREATE UNIQUE INDEX "AttributeOption_code_key" ON "AttributeOption"("code");

-- ProductListing: option codes replace option ids (rebuilt below).
ALTER TABLE "ProductListing" DROP COLUMN "optionIds",
ADD COLUMN "optionCodes" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
CREATE INDEX "ProductListing_optionCodes_idx" ON "ProductListing" USING GIN ("optionCodes");

-- Same refresh logic as 20261012122000_product_listing_sync, collecting option codes.
CREATE OR REPLACE FUNCTION refresh_product_listing(p_ids text[]) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_id text;
  v_all_lock CONSTANT integer := 0;
  v_lock_class CONSTANT integer := 471100; -- namespace for listing advisory locks
BEGIN
  IF current_setting('timmbr.listing_sync', true) = 'off' THEN
    RETURN;
  END IF;

  IF p_ids IS NOT NULL THEN
    p_ids := ARRAY(SELECT DISTINCT x FROM unnest(p_ids) AS x WHERE x IS NOT NULL ORDER BY x);
    IF cardinality(p_ids) = 0 THEN
      RETURN;
    END IF;
  END IF;

  IF p_ids IS NULL OR cardinality(p_ids) > 500 THEN
    PERFORM pg_advisory_xact_lock(v_lock_class, v_all_lock);
  ELSE
    PERFORM pg_advisory_xact_lock_shared(v_lock_class, v_all_lock);
    FOREACH v_id IN ARRAY p_ids LOOP
      PERFORM pg_advisory_xact_lock(v_lock_class + 1, hashtext(v_id));
    END LOOP;
  END IF;

  WITH RECURSIVE walk AS (
    -- Every category's path to its root (depth-limited: a cycle never reaches a root).
    SELECT c.id, c."parentId" AS cur, ARRAY[c.id] AS path, 1 AS depth,
           (c.status = 'ACTIVE') AS all_active
    FROM "Category" c
    UNION ALL
    SELECT w.id, p."parentId", w.path || p.id, w.depth + 1, w.all_active AND p.status = 'ACTIVE'
    FROM walk w
    JOIN "Category" p ON p.id = w.cur
    WHERE w.depth < 10
  ),
  cat AS (
    SELECT id, path FROM walk WHERE cur IS NULL AND all_active
  ),
  src AS (
    SELECT
      p.id AS "productId",
      p.slug,
      p.title,
      b.id AS "brandId",
      b.name AS "brandName",
      p."categoryId",
      cat.path AS "categoryPath",
      round(dv.price, 2) AS price,
      CASE WHEN dv."compareAtPrice" > dv.price THEN round(dv."compareAtPrice", 2) END AS "compareAtPrice",
      dv.currency,
      CASE WHEN dv."compareAtPrice" > dv.price AND dv."compareAtPrice" > 0
           THEN floor((dv."compareAtPrice" - dv.price) * 100 / dv."compareAtPrice")::int
           ELSE 0 END AS "discountPct",
      (SELECT count(*) FROM "ProductVariant" v
        WHERE v."productId" = p.id AND v.status = 'ACTIVE') > 1 AS "hasMultipleVariants",
      EXISTS (SELECT 1 FROM "ProductVariant" v JOIN "Inventory" i ON i."variantId" = v.id
              WHERE v."productId" = p.id AND v.status = 'ACTIVE'
                AND i.quantity - i."reservedQuantity" > 0) AS "inStock",
      img."storageKey" AS "coverImageKey",
      img."altText" AS "coverAlt",
      ARRAY(
        SELECT DISTINCT o.code FROM (
          SELECT ao.code
          FROM "AttributeValue" av
          JOIN "AttributeValueOption" avo ON avo."attributeValueId" = av.id
          JOIN "AttributeOption" ao ON ao.id = avo."optionId"
          WHERE av."productId" = p.id
          UNION
          SELECT ao.code
          FROM "ProductVariant" v
          JOIN "AttributeValue" av ON av."variantId" = v.id
          JOIN "AttributeValueOption" avo ON avo."attributeValueId" = av.id
          JOIN "AttributeOption" ao ON ao.id = avo."optionId"
          WHERE v."productId" = p.id AND v.status = 'ACTIVE'
        ) o ORDER BY o.code
      ) AS "optionCodes",
      p."createdAt"
    FROM "Product" p
    JOIN cat ON cat.id = p."categoryId"
    -- Listing price = the default ACTIVE variant, else the oldest ACTIVE one (same rule as ProductMapper).
    JOIN LATERAL (
      SELECT v.price, v."compareAtPrice", v.currency
      FROM "ProductVariant" v
      WHERE v."productId" = p.id AND v.status = 'ACTIVE'
      ORDER BY v."isDefault" DESC, v."createdAt" ASC, v.id
      LIMIT 1
    ) dv ON true
    LEFT JOIN "Brand" b ON b.id = p."brandId" AND b.status = 'ACTIVE'
    LEFT JOIN LATERAL (
      SELECT i."storageKey", i."altText"
      FROM "ProductImage" i
      WHERE i."productId" = p.id
      ORDER BY i."isPrimary" DESC, i."sortOrder", i."createdAt", i.id
      LIMIT 1
    ) img ON true
    WHERE (p_ids IS NULL OR p.id = ANY (p_ids))
      AND p.status = 'ACTIVE'
      AND dv.currency = 'INR'
  ),
  upd AS (
    UPDATE "ProductListing" l SET
      slug = s.slug, title = s.title, "brandId" = s."brandId", "brandName" = s."brandName",
      "categoryId" = s."categoryId", "categoryPath" = s."categoryPath", price = s.price,
      "compareAtPrice" = s."compareAtPrice", currency = s.currency, "discountPct" = s."discountPct",
      "hasMultipleVariants" = s."hasMultipleVariants", "inStock" = s."inStock",
      "coverImageKey" = s."coverImageKey", "coverAlt" = s."coverAlt", "optionCodes" = s."optionCodes",
      "createdAt" = s."createdAt", "refreshedAt" = now()
    FROM src s
    WHERE l."productId" = s."productId"
      AND (l.slug, l.title, l."brandId", l."brandName", l."categoryId", l."categoryPath", l.price,
           l."compareAtPrice", l.currency, l."discountPct", l."hasMultipleVariants", l."inStock",
           l."coverImageKey", l."coverAlt", l."optionCodes", l."createdAt")
          IS DISTINCT FROM
          (s.slug, s.title, s."brandId", s."brandName", s."categoryId", s."categoryPath", s.price,
           s."compareAtPrice", s.currency, s."discountPct", s."hasMultipleVariants", s."inStock",
           s."coverImageKey", s."coverAlt", s."optionCodes", s."createdAt")
    RETURNING l."productId"
  ),
  ins AS (
    INSERT INTO "ProductListing" (
      "productId", slug, title, "brandId", "brandName", "categoryId", "categoryPath", price,
      "compareAtPrice", currency, "discountPct", "hasMultipleVariants", "inStock",
      "coverImageKey", "coverAlt", "optionCodes", "createdAt", "refreshedAt")
    SELECT s."productId", s.slug, s.title, s."brandId", s."brandName", s."categoryId",
           s."categoryPath", s.price, s."compareAtPrice", s.currency, s."discountPct",
           s."hasMultipleVariants", s."inStock", s."coverImageKey", s."coverAlt", s."optionCodes",
           s."createdAt", now()
    FROM src s
    WHERE NOT EXISTS (SELECT 1 FROM "ProductListing" l WHERE l."productId" = s."productId")
    ON CONFLICT ("productId") DO NOTHING
    RETURNING "productId"
  )
  -- Products in scope that are no longer listable.
  DELETE FROM "ProductListing" l
  WHERE (p_ids IS NULL OR l."productId" = ANY (p_ids))
    AND NOT EXISTS (SELECT 1 FROM src s WHERE s."productId" = l."productId");
END;
$$;

-- Backfill.
SELECT refresh_product_listing(NULL);
