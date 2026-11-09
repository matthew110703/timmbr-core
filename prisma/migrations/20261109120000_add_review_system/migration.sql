-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ReviewMediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "ReviewRevisionStatus" AS ENUM ('PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewModerationAction" AS ENUM ('APPROVE', 'REJECT', 'HIDE', 'RESTORE', 'APPROVE_REVISION', 'REJECT_REVISION');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "ratingAvg" DECIMAL(3,2),
ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rating1Count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rating2Count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rating3Count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rating4Count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rating5Count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductListing" ADD COLUMN "ratingAvg" DECIMAL(3,2),
ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRevision" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "status" "ReviewRevisionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewMedia" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "revisionId" TEXT,
    "storageKey" TEXT NOT NULL,
    "thumbnailStorageKey" TEXT,
    "kind" "ReviewMediaKind" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewHelpfulVote" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewHelpfulVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewModerationEvent" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "revisionId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" "ReviewModerationAction" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewModerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Review_productId_status_createdAt_idx" ON "Review"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_userId_createdAt_idx" ON "Review"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderId_productId_key" ON "Review"("orderId", "productId");

-- CreateIndex
CREATE INDEX "ReviewRevision_reviewId_status_idx" ON "ReviewRevision"("reviewId", "status");

-- CreateIndex
CREATE INDEX "ReviewMedia_reviewId_revisionId_sortOrder_idx" ON "ReviewMedia"("reviewId", "revisionId", "sortOrder");

-- CreateIndex
CREATE INDEX "ReviewMedia_revisionId_idx" ON "ReviewMedia"("revisionId");

-- CreateIndex
CREATE INDEX "ReviewHelpfulVote_userId_idx" ON "ReviewHelpfulVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewHelpfulVote_reviewId_userId_key" ON "ReviewHelpfulVote"("reviewId", "userId");

-- CreateIndex
CREATE INDEX "ReviewModerationEvent_reviewId_createdAt_idx" ON "ReviewModerationEvent"("reviewId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewModerationEvent_actorId_createdAt_idx" ON "ReviewModerationEvent"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRevision" ADD CONSTRAINT "ReviewRevision_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewMedia" ADD CONSTRAINT "ReviewMedia_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewMedia" ADD CONSTRAINT "ReviewMedia_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ReviewRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewHelpfulVote" ADD CONSTRAINT "ReviewHelpfulVote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewHelpfulVote" ADD CONSTRAINT "ReviewHelpfulVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewModerationEvent" ADD CONSTRAINT "ReviewModerationEvent_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewModerationEvent" ADD CONSTRAINT "ReviewModerationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ProductListing: copy rating fields from Product on refresh (same logic as 20261013130000_listing_default_variant).
CREATE OR REPLACE FUNCTION refresh_product_listing(p_ids text[]) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_id text;
  v_all_lock CONSTANT integer := 0;
  v_lock_class CONSTANT integer := 471100;
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
      lower(btrim(regexp_replace(p.title || ' ' || coalesce(b.name, ''), '\s+', ' ', 'g'))) AS "searchText",
      p."categoryId",
      cat.path AS "categoryPath",
      dv.id AS "defaultVariantId",
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
      p."ratingAvg",
      p."ratingCount",
      p."createdAt"
    FROM "Product" p
    JOIN cat ON cat.id = p."categoryId"
    JOIN LATERAL (
      SELECT v.id, v.price, v."compareAtPrice", v.currency
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
      "searchText" = s."searchText",
      "defaultVariantId" = s."defaultVariantId",
      "categoryId" = s."categoryId", "categoryPath" = s."categoryPath", price = s.price,
      "compareAtPrice" = s."compareAtPrice", currency = s.currency, "discountPct" = s."discountPct",
      "hasMultipleVariants" = s."hasMultipleVariants", "inStock" = s."inStock",
      "coverImageKey" = s."coverImageKey", "coverAlt" = s."coverAlt", "optionCodes" = s."optionCodes",
      "ratingAvg" = s."ratingAvg", "ratingCount" = s."ratingCount",
      "createdAt" = s."createdAt", "refreshedAt" = now()
    FROM src s
    WHERE l."productId" = s."productId"
      AND (l.slug, l.title, l."brandId", l."brandName", l."searchText", l."defaultVariantId", l."categoryId", l."categoryPath", l.price,
           l."compareAtPrice", l.currency, l."discountPct", l."hasMultipleVariants", l."inStock",
           l."coverImageKey", l."coverAlt", l."optionCodes", l."ratingAvg", l."ratingCount", l."createdAt")
          IS DISTINCT FROM
          (s.slug, s.title, s."brandId", s."brandName", s."searchText", s."defaultVariantId", s."categoryId", s."categoryPath", s.price,
           s."compareAtPrice", s.currency, s."discountPct", s."hasMultipleVariants", s."inStock",
           s."coverImageKey", s."coverAlt", s."optionCodes", s."ratingAvg", s."ratingCount", s."createdAt")
    RETURNING l."productId"
  ),
  ins AS (
    INSERT INTO "ProductListing" (
      "productId", slug, title, "brandId", "brandName", "searchText", "defaultVariantId", "categoryId", "categoryPath", price,
      "compareAtPrice", currency, "discountPct", "hasMultipleVariants", "inStock",
      "coverImageKey", "coverAlt", "optionCodes", "ratingAvg", "ratingCount", "createdAt", "refreshedAt")
    SELECT s."productId", s.slug, s.title, s."brandId", s."brandName", s."searchText", s."defaultVariantId", s."categoryId",
           s."categoryPath", s.price, s."compareAtPrice", s.currency, s."discountPct",
           s."hasMultipleVariants", s."inStock", s."coverImageKey", s."coverAlt", s."optionCodes",
           s."ratingAvg", s."ratingCount", s."createdAt", now()
    FROM src s
    WHERE NOT EXISTS (SELECT 1 FROM "ProductListing" l WHERE l."productId" = s."productId")
    ON CONFLICT ("productId") DO NOTHING
    RETURNING "productId"
  )
  DELETE FROM "ProductListing" l
  WHERE (p_ids IS NULL OR l."productId" = ANY (p_ids))
    AND NOT EXISTS (SELECT 1 FROM src s WHERE s."productId" = l."productId");
END;
$$;

SELECT refresh_product_listing(NULL);
