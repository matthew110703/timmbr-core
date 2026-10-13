-- Keeps "ProductListing" (the PLP read model) in sync with the catalog tables.
--
-- Every write path (admin APIs, order/payment/webhook flows, seeds, manual SQL) goes through
-- these triggers, so the read model can't drift. All row logic lives in
-- refresh_product_listing(); the triggers only collect affected product ids.

-- ---------------------------------------------------------------------------------------------
-- refresh_product_listing(ids): recompute the listing rows of the given products (NULL = all).
--
-- Concurrency:
--   * A per-product advisory lock (taken in sorted order) serialises refreshes of the same
--     product, and the rows are computed in a LATER statement than the lock. Under READ
--     COMMITTED that statement gets a fresh snapshot, so it sees whatever a concurrent writer
--     committed while we waited (no lost updates).
--   * Full rebuilds (and very large id sets) take one exclusive lock instead of thousands of
--     per-product ones; ordinary refreshes hold that lock in shared mode.
--   * Only rows that actually change are written, so unchanged products aren't locked/rewritten.
-- Bulk loads can skip the work with  SELECT set_config('timmbr.listing_sync', 'off', true)
-- (transaction-local) and rebuild once at the end.
-- ---------------------------------------------------------------------------------------------
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
        SELECT DISTINCT o.id FROM (
          SELECT avo."optionId" AS id
          FROM "AttributeValue" av
          JOIN "AttributeValueOption" avo ON avo."attributeValueId" = av.id
          WHERE av."productId" = p.id
          UNION
          SELECT avo."optionId"
          FROM "ProductVariant" v
          JOIN "AttributeValue" av ON av."variantId" = v.id
          JOIN "AttributeValueOption" avo ON avo."attributeValueId" = av.id
          WHERE v."productId" = p.id AND v.status = 'ACTIVE'
        ) o ORDER BY o.id
      ) AS "optionIds",
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
      "coverImageKey" = s."coverImageKey", "coverAlt" = s."coverAlt", "optionIds" = s."optionIds",
      "createdAt" = s."createdAt", "refreshedAt" = now()
    FROM src s
    WHERE l."productId" = s."productId"
      AND (l.slug, l.title, l."brandId", l."brandName", l."categoryId", l."categoryPath", l.price,
           l."compareAtPrice", l.currency, l."discountPct", l."hasMultipleVariants", l."inStock",
           l."coverImageKey", l."coverAlt", l."optionIds", l."createdAt")
          IS DISTINCT FROM
          (s.slug, s.title, s."brandId", s."brandName", s."categoryId", s."categoryPath", s.price,
           s."compareAtPrice", s.currency, s."discountPct", s."hasMultipleVariants", s."inStock",
           s."coverImageKey", s."coverAlt", s."optionIds", s."createdAt")
    RETURNING l."productId"
  ),
  ins AS (
    INSERT INTO "ProductListing" (
      "productId", slug, title, "brandId", "brandName", "categoryId", "categoryPath", price,
      "compareAtPrice", currency, "discountPct", "hasMultipleVariants", "inStock",
      "coverImageKey", "coverAlt", "optionIds", "createdAt", "refreshedAt")
    SELECT s."productId", s.slug, s.title, s."brandId", s."brandName", s."categoryId",
           s."categoryPath", s.price, s."compareAtPrice", s.currency, s."discountPct",
           s."hasMultipleVariants", s."inStock", s."coverImageKey", s."coverAlt", s."optionIds",
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

-- ---------------------------------------------------------------------------------------------
-- Statement-level triggers. Postgres allows transition tables only on single-event triggers
-- without column lists, so each table gets one trigger per event, and UPDATE triggers collect
-- ids from both the old and the new rows (a moved image/variant refreshes both products).
-- ---------------------------------------------------------------------------------------------

-- Product: INSERT/UPDATE. (DELETE removes the listing row through its FK cascade.)
CREATE OR REPLACE FUNCTION listing_trg_product() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM refresh_product_listing(ARRAY(SELECT id FROM new_rows));
  ELSE
    PERFORM refresh_product_listing(ARRAY(SELECT id FROM new_rows UNION SELECT id FROM old_rows));
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER listing_product_ins AFTER INSERT ON "Product"
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION listing_trg_product();
CREATE TRIGGER listing_product_upd AFTER UPDATE ON "Product"
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION listing_trg_product();

-- Child tables that carry "productId" directly: ProductVariant, ProductImage.
CREATE OR REPLACE FUNCTION listing_trg_by_product_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM refresh_product_listing(ARRAY(SELECT "productId" FROM new_rows));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM refresh_product_listing(
      ARRAY(SELECT "productId" FROM new_rows UNION SELECT "productId" FROM old_rows));
  ELSE
    PERFORM refresh_product_listing(ARRAY(SELECT "productId" FROM old_rows));
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER listing_variant_ins AFTER INSERT ON "ProductVariant"
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION listing_trg_by_product_id();
CREATE TRIGGER listing_variant_upd AFTER UPDATE ON "ProductVariant"
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION listing_trg_by_product_id();
CREATE TRIGGER listing_variant_del AFTER DELETE ON "ProductVariant"
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION listing_trg_by_product_id();

CREATE TRIGGER listing_image_ins AFTER INSERT ON "ProductImage"
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION listing_trg_by_product_id();
CREATE TRIGGER listing_image_upd AFTER UPDATE ON "ProductImage"
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION listing_trg_by_product_id();
CREATE TRIGGER listing_image_del AFTER DELETE ON "ProductImage"
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION listing_trg_by_product_id();

-- AttributeValue: owned by a product or by a variant. When a variant (and, by cascade, its values)
-- is deleted the variant row is already gone; the ProductVariant trigger covers that case.
CREATE OR REPLACE FUNCTION listing_trg_attribute_value() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM refresh_product_listing(ARRAY(
      SELECT COALESCE(r."productId", v."productId")
      FROM new_rows r LEFT JOIN "ProductVariant" v ON v.id = r."variantId"));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM refresh_product_listing(ARRAY(
      SELECT COALESCE(r."productId", v."productId")
      FROM (SELECT "productId", "variantId" FROM new_rows
            UNION SELECT "productId", "variantId" FROM old_rows) r
      LEFT JOIN "ProductVariant" v ON v.id = r."variantId"));
  ELSE
    PERFORM refresh_product_listing(ARRAY(
      SELECT COALESCE(r."productId", v."productId")
      FROM old_rows r LEFT JOIN "ProductVariant" v ON v.id = r."variantId"));
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER listing_attr_value_ins AFTER INSERT ON "AttributeValue"
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION listing_trg_attribute_value();
CREATE TRIGGER listing_attr_value_upd AFTER UPDATE ON "AttributeValue"
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION listing_trg_attribute_value();
CREATE TRIGGER listing_attr_value_del AFTER DELETE ON "AttributeValue"
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION listing_trg_attribute_value();

-- AttributeValueOption: resolve through its AttributeValue. On a cascade from AttributeValue the
-- value row is gone (nothing resolves) and the AttributeValue trigger has already refreshed.
CREATE OR REPLACE FUNCTION listing_trg_attribute_value_option() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM refresh_product_listing(ARRAY(
      SELECT COALESCE(av."productId", v."productId")
      FROM new_rows r
      JOIN "AttributeValue" av ON av.id = r."attributeValueId"
      LEFT JOIN "ProductVariant" v ON v.id = av."variantId"));
  ELSE
    PERFORM refresh_product_listing(ARRAY(
      SELECT COALESCE(av."productId", v."productId")
      FROM old_rows r
      JOIN "AttributeValue" av ON av.id = r."attributeValueId"
      LEFT JOIN "ProductVariant" v ON v.id = av."variantId"));
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER listing_attr_value_option_ins AFTER INSERT ON "AttributeValueOption"
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION listing_trg_attribute_value_option();
CREATE TRIGGER listing_attr_value_option_del AFTER DELETE ON "AttributeValueOption"
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION listing_trg_attribute_value_option();

-- Brand: a rename or status change touches its products. (A delete sets Product."brandId" to
-- NULL, which fires the Product trigger.)
CREATE OR REPLACE FUNCTION listing_trg_brand() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_product_listing(ARRAY(
    SELECT p.id
    FROM new_rows n
    JOIN old_rows o ON o.id = n.id
    JOIN "Product" p ON p."brandId" = n.id
    WHERE (n.name, n.status) IS DISTINCT FROM (o.name, o.status)));
  RETURN NULL;
END;
$$;

CREATE TRIGGER listing_brand_upd AFTER UPDATE ON "Brand"
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION listing_trg_brand();

-- Category: a move or status change affects every product in the subtree. (Products RESTRICT
-- category deletes, so a deleted category never has products.)
CREATE OR REPLACE FUNCTION listing_trg_category() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_product_listing(ARRAY(
    WITH RECURSIVE sub AS (
      SELECT n.id, 1 AS depth
      FROM new_rows n
      JOIN old_rows o ON o.id = n.id
      WHERE (n."parentId", n.status) IS DISTINCT FROM (o."parentId", o.status)
      UNION
      SELECT c.id, s.depth + 1
      FROM "Category" c
      JOIN sub s ON c."parentId" = s.id
      WHERE s.depth < 10
    )
    SELECT p.id FROM "Product" p WHERE p."categoryId" IN (SELECT id FROM sub)));
  RETURN NULL;
END;
$$;

CREATE TRIGGER listing_category_upd AFTER UPDATE ON "Category"
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION listing_trg_category();

-- Inventory (hot path: every order reserves/releases stock). Row-level and filtered by WHEN, so
-- it fires only when a variant's available stock crosses zero — the only change "inStock" sees.
CREATE OR REPLACE FUNCTION listing_trg_inventory() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM refresh_product_listing(ARRAY(
      SELECT v."productId" FROM "ProductVariant" v WHERE v.id IN (NEW."variantId", OLD."variantId")));
  ELSE
    PERFORM refresh_product_listing(ARRAY(
      SELECT v."productId" FROM "ProductVariant" v WHERE v.id = NEW."variantId"));
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER listing_inventory_upd AFTER UPDATE ON "Inventory"
  FOR EACH ROW
  WHEN ((OLD.quantity - OLD."reservedQuantity" > 0)
        IS DISTINCT FROM (NEW.quantity - NEW."reservedQuantity" > 0)
        OR OLD."variantId" IS DISTINCT FROM NEW."variantId")
  EXECUTE FUNCTION listing_trg_inventory();
CREATE TRIGGER listing_inventory_ins AFTER INSERT ON "Inventory"
  FOR EACH ROW
  WHEN (NEW.quantity - NEW."reservedQuantity" > 0)
  EXECUTE FUNCTION listing_trg_inventory();

-- Backfill.
SELECT refresh_product_listing(NULL);
