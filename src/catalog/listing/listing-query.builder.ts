import { Prisma } from '@prisma/client';
import { ListingCriteria, ListingSort, ResolvedGroup } from './listing.types';
import { searchTerms } from './search-terms';

/**
 * SQL for the listing, over the "ProductListing" read model only (no joins).
 *
 * Every predicate is index-backed: categoryPath @> (GIN), optionCodes && (GIN), searchText LIKE
 * per word (trigram GIN), price range, and each sort has an ("inStock" DESC, <sort>, "productId") index.
 * All values are bound parameters; arrays are cast to text[] (ids are TEXT columns).
 */

/** Escapes LIKE wildcards so a search for "50%" matches the text "50%". */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

interface ConditionOptions {
  /** Leave out this group (counts for a selected group ignore its own selection). */
  skipGroup?: string;
  /** Leave out the price range (the slider bounds ignore the current price filter). */
  skipPrice?: boolean;
}

/**
 * Every word of the query (normalised by toSearchQuery: lowercase) must appear in the title or
 * brand name. "searchText" is stored lowercase, so a plain LIKE is enough; the trigram index
 * serves the AND.
 */
export function searchCondition(q: string): Prisma.Sql {
  return Prisma.join(
    searchTerms(q).map(
      (term) => Prisma.sql`"searchText" LIKE ${`%${escapeLike(term)}%`} ESCAPE '\\'`,
    ),
    ' AND ',
  );
}

/** Best match first: how closely the query matches a run of words in the title + brand. */
function relevance(q: string): Prisma.Sql {
  return Prisma.sql`word_similarity(${q}, "searchText") DESC`;
}

function groupCondition(group: ResolvedGroup): Prisma.Sql {
  return group.kind === 'brand'
    ? Prisma.sql`"brandId" = ANY(${group.ids}::text[])`
    : Prisma.sql`"optionCodes" && ${group.codes}::int[]`;
}

/** WHERE clause: AND across groups, OR within a group (&& is "has any of"). */
export function listingConditions(
  criteria: ListingCriteria,
  options: ConditionOptions = {},
): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (criteria.categoryId) {
    parts.push(Prisma.sql`"categoryPath" @> ARRAY[${criteria.categoryId}]::text[]`);
  }
  if (criteria.q) {
    parts.push(searchCondition(criteria.q));
  }
  if (!options.skipPrice) {
    if (criteria.priceMin !== null) parts.push(Prisma.sql`"price" >= ${criteria.priceMin}`);
    if (criteria.priceMax !== null) parts.push(Prisma.sql`"price" <= ${criteria.priceMax}`);
  }
  for (const group of criteria.groups) {
    if (group.key !== options.skipGroup) parts.push(groupCondition(group));
  }
  return parts.length > 0 ? Prisma.join(parts, ' AND ') : Prisma.sql`TRUE`;
}

function sortOrder(sort: ListingSort, q: string | null): Prisma.Sql {
  switch (sort) {
    case 'price_asc':
      return Prisma.sql`"price" ASC`;
    case 'price_desc':
      return Prisma.sql`"price" DESC`;
    case 'discount':
      return Prisma.sql`"discountPct" DESC`;
    case 'newest':
      return Prisma.sql`"createdAt" DESC`;
    case 'relevance':
      // With a search, closest matches first; otherwise newest first.
      return q ? Prisma.sql`${relevance(q)}, "createdAt" DESC` : Prisma.sql`"createdAt" DESC`;
  }
}

/** The ProductListing columns a product card needs. */
const CARD_COLUMNS = Prisma.sql`"productId", slug, title, "brandName", price, "compareAtPrice",
  currency, "discountPct", "hasMultipleVariants", "inStock", "coverImageKey", "coverAlt",
  "defaultVariantId"`;

/**
 * Typeahead candidates: the ranking runs on at most this many matches (in-stock, newest first).
 * A common word ("teak") can match thousands of rows, and scoring them all costs ~30ms at 50k
 * products; taking the candidates off the ("inStock", "createdAt") index costs well under 1ms.
 */
export const SUGGEST_CANDIDATES = 200;

/**
 * Typeahead: the best few matches for a normalised query across the whole catalog, in one
 * statement and with no count (the results page has the total). Rare queries rank every match;
 * common ones rank their newest SUGGEST_CANDIDATES.
 */
export function searchSuggestQuery(q: string, limit: number): Prisma.Sql {
  return Prisma.sql`
    WITH candidates AS (
      SELECT ${CARD_COLUMNS}, "searchText", "createdAt"
      FROM "ProductListing"
      WHERE ${searchCondition(q)}
      ORDER BY "inStock" DESC, "createdAt" DESC, "productId" ASC
      LIMIT ${SUGGEST_CANDIDATES}
    )
    SELECT ${CARD_COLUMNS}
    FROM candidates
    ORDER BY "inStock" DESC, ${relevance(q)}, "createdAt" DESC, "productId" ASC
    LIMIT ${limit}`;
}

/** One page of cards. In-stock first; "productId" breaks ties so pages never overlap. */
export function listingPageQuery(criteria: ListingCriteria): Prisma.Sql {
  return Prisma.sql`
    SELECT ${CARD_COLUMNS}
    FROM "ProductListing"
    WHERE ${listingConditions(criteria)}
    ORDER BY "inStock" DESC, ${sortOrder(criteria.sort, criteria.q)}, "productId" ASC
    LIMIT ${criteria.limit} OFFSET ${(criteria.page - 1) * criteria.limit}`;
}

/**
 * Total, price bounds and facet counts in ONE statement, from ONE scan of the matching rows:
 *
 * 1. `base` reads the rows matching the category and search once, and computes a flag per
 *    filter group (and for the price range) instead of filtering on them;
 * 2. option codes are unnested once, and every count is a FILTER over those flags:
 *    - under all filters (used for groups with nothing selected);
 *    - for each selected group, under all filters EXCEPT that group, so picking "Teak" still
 *      shows how many "Walnut" products there are;
 * 3. the per-scope columns are unpivoted back into rows (kind, grp, id, n).
 * Brands follow the same rule; price bounds ignore the price filter. Counts are of products:
 * optionCodes holds distinct codes, so nothing counts twice.
 */
export function listingAggregateQuery(criteria: ListingCriteria): Prisma.Sql {
  const groups = criteria.groups;
  const flag = (i: number) => Prisma.raw(`g${i}`);
  const and = (parts: Prisma.Sql[]) =>
    parts.length ? Prisma.join(parts, ' AND ') : Prisma.sql`TRUE`;
  /** All group flags except one (the scope of that group's own counts). */
  const groupsExcept = (skip: number) =>
    and(groups.flatMap((_, i) => (i === skip ? [] : [flag(i)])));
  const allGroups = groupsExcept(-1);
  const all = Prisma.sql`p_ok AND ${allGroups}`;

  const priceParts: Prisma.Sql[] = [];
  if (criteria.priceMin !== null) priceParts.push(Prisma.sql`price >= ${criteria.priceMin}`);
  if (criteria.priceMax !== null) priceParts.push(Prisma.sql`price <= ${criteria.priceMax}`);

  const flags = groups.map((group, i) => Prisma.sql`(${groupCondition(group)}) AS ${flag(i)}`);
  // A row affects some count only if it fails at most ONE condition (a group or the price):
  // the total needs none failed, a group's own counts allow only that group to fail, and the
  // price bounds allow only the price to fail. Dropping the rest before the unnest keeps
  // multi-filter requests cheap.
  const conditions = [
    ...(priceParts.length ? [and(priceParts)] : []),
    ...groups.map((group) => groupCondition(group)),
  ];
  const atMostOneFails =
    conditions.length > 1
      ? Prisma.sql` AND (${Prisma.join(
          conditions.map((c) => Prisma.sql`(${c})::int`),
          ' + ',
        )}) >= ${conditions.length - 1}`
      : Prisma.empty;
  const optionScopes = groups.flatMap((group, i) =>
    group.kind === 'option'
      ? [{ key: group.key, filter: Prisma.sql`p_ok AND ${groupsExcept(i)}` }]
      : [],
  );
  const brandIndex = groups.findIndex((group) => group.kind === 'brand');

  const optionColumns = [
    Prisma.sql`count(*) FILTER (WHERE ${all}) AS n_all`,
    ...optionScopes.map(
      (scope, i) => Prisma.sql`count(*) FILTER (WHERE ${scope.filter}) AS ${Prisma.raw(`n_${i}`)}`,
    ),
  ];
  const optionRows = [
    Prisma.sql`(NULL::text, opt.n_all)`,
    ...optionScopes.map(
      (scope, i) => Prisma.sql`(${scope.key}::text, ${Prisma.raw(`opt.n_${i}`)})`,
    ),
  ];
  const brandColumns = [
    Prisma.sql`count(*) FILTER (WHERE ${all}) AS n_all`,
    ...(brandIndex >= 0
      ? [Prisma.sql`count(*) FILTER (WHERE p_ok AND ${groupsExcept(brandIndex)}) AS n_scoped`]
      : []),
  ];
  const brandRows = [
    Prisma.sql`(NULL::text, b.n_all)`,
    ...(brandIndex >= 0 ? [Prisma.sql`(${groups[brandIndex].key}::text, b.n_scoped)`] : []),
  ];

  return Prisma.sql`
    WITH base AS MATERIALIZED (
      SELECT "optionCodes", "brandId", price,
             (${and(priceParts)}) AS p_ok
             ${flags.length ? Prisma.sql`, ${Prisma.join(flags, ', ')}` : Prisma.empty}
      FROM "ProductListing"
      WHERE ${listingConditions({ ...criteria, groups: [] }, { skipPrice: true })}${atMostOneFails}
    ),
    opt AS (
      SELECT o, ${Prisma.join(optionColumns, ', ')}
      FROM base, unnest("optionCodes") AS o
      GROUP BY o
    ),
    b AS (
      SELECT "brandId", ${Prisma.join(brandColumns, ', ')}
      FROM base
      WHERE "brandId" IS NOT NULL
      GROUP BY "brandId"
    )
    SELECT 'total'::text AS kind, NULL::text AS grp, NULL::text AS id,
           count(*) FILTER (WHERE ${all})::int AS n, NULL::numeric AS minp, NULL::numeric AS maxp
    FROM base
    UNION ALL
    SELECT 'price', NULL, NULL, NULL,
           min(price) FILTER (WHERE ${allGroups}), max(price) FILTER (WHERE ${allGroups})
    FROM base
    UNION ALL
    SELECT 'opt', v.grp, opt.o::text, v.n::int, NULL, NULL
    FROM opt CROSS JOIN LATERAL (VALUES ${Prisma.join(optionRows, ', ')}) AS v(grp, n)
    WHERE v.n > 0
    UNION ALL
    SELECT 'brand', v.grp, b."brandId", v.n::int, NULL, NULL
    FROM b CROSS JOIN LATERAL (VALUES ${Prisma.join(brandRows, ', ')}) AS v(grp, n)
    WHERE v.n > 0`;
}
