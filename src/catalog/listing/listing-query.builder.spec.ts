import {
  escapeLike,
  listingAggregateQuery,
  listingConditions,
  listingPageQuery,
  searchSuggestQuery,
} from './listing-query.builder';
import { ListingCriteria } from './listing.types';

const base: ListingCriteria = {
  categoryId: null,
  q: null,
  priceMin: null,
  priceMax: null,
  groups: [],
  sort: 'relevance',
  page: 1,
  limit: 24,
};

const material = { key: 'material', kind: 'option' as const, codes: [7] };
const brand = { key: 'brand', kind: 'brand' as const, ids: ['b-1'] };

describe('listing query builder', () => {
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('is TRUE without any filter', () => {
    expect(listingConditions(base).sql).toBe('TRUE');
  });

  it('binds every value as a parameter', () => {
    const where = listingConditions({
      ...base,
      categoryId: 'cat-1',
      q: "o'neil 50%",
      priceMin: 1000,
      priceMax: 5000,
      groups: [material, brand],
    });
    expect(where.sql).not.toContain("o'neil");
    expect(where.sql).toContain('"categoryPath" @> ARRAY[?]::text[]');
    expect(where.sql).toContain('"optionCodes" && ?::int[]');
    expect(where.sql).toContain('"brandId" = ANY(?::text[])');
    expect(where.values).toEqual(['cat-1', "%o'neil%", '%50\\%%', 1000, 5000, [7], ['b-1']]);
  });

  it('can leave out a group and the price range', () => {
    const criteria = { ...base, priceMin: 1000, groups: [material, brand] };
    const sql = listingConditions(criteria, { skipGroup: 'material', skipPrice: true }).sql;
    expect(sql).not.toContain('optionCodes');
    expect(sql).not.toContain('price');
    expect(sql).toContain('brandId');
  });

  it('pages with in-stock first and a stable tiebreak', () => {
    const page = listingPageQuery({ ...base, sort: 'price_desc', page: 3, limit: 12 });
    expect(page.sql).toMatch(/ORDER BY "inStock" DESC, "price" DESC, "productId" ASC/);
    expect(page.values.slice(-2)).toEqual([12, 24]);
  });

  it('matches every search word in the title + brand text', () => {
    const where = listingConditions({ ...base, q: 'teak bed' });
    expect(where.sql).toBe(`"searchText" LIKE ? ESCAPE '\\' AND "searchText" LIKE ? ESCAPE '\\'`);
    expect(where.values).toEqual(['%teak%', '%bed%']);
  });

  it('orders a search by word similarity, then newest', () => {
    const page = listingPageQuery({ ...base, q: 'teak bed' });
    expect(page.sql).toContain('word_similarity(?, "searchText") DESC, "createdAt" DESC');
    expect(page.values[2]).toBe('teak bed');
  });

  it('suggests the best few in-stock matches across the catalog', () => {
    const sql = searchSuggestQuery('teak bed', 5);
    expect(sql.sql).toMatch(
      /ORDER BY "inStock" DESC, word_similarity\(\?, "searchText"\) DESC, "createdAt" DESC, "productId" ASC\s+LIMIT \?/,
    );
    expect(sql.sql).toMatch(/LIMIT \?\s+\)/); // the candidates are capped before ranking
    expect(sql.sql).not.toContain('categoryPath');
    expect(sql.values).toEqual(['%teak%', '%bed%', 200, 'teak bed', 5]);
  });

  it('counts every scope from one scan and one unnest', () => {
    const sql = listingAggregateQuery({ ...base, priceMin: 1000, groups: [material, brand] }).sql;
    expect(sql.match(/FROM "ProductListing"/g)).toHaveLength(1);
    expect(sql.match(/unnest\(/g)).toHaveLength(1);
    // material (g0) is counted without its own flag, brand (g1) without its own.
    expect(sql).toContain('count(*) FILTER (WHERE p_ok AND g1) AS n_0');
    expect(sql).toContain('count(*) FILTER (WHERE p_ok AND g0) AS n_scoped');
    // price bounds ignore the price flag.
    expect(sql).toContain('min(price) FILTER (WHERE g0 AND g1)');
  });

  it('still works without any group', () => {
    const sql = listingAggregateQuery(base).sql;
    expect(sql).toContain('count(*) FILTER (WHERE p_ok AND TRUE) AS n_all');
  });
});
