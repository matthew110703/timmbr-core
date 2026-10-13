import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CategoryService } from '@/category/category.service';
import { CategoryListingContextDto } from '@/category/dto/category-listing-context.dto';
import { MediaService } from '@/media/media.service';
import { GetListingQueryDto } from './dto/get-listing-query.dto';
import { SearchSuggestQueryDto } from './dto/search-suggest-query.dto';
import {
  ListingAppliedDto,
  ListingFacetsResponseDto,
  ListingResponseDto,
  SearchSuggestResponseDto,
} from './dto/listing-response.dto';
import { CatalogCache } from './catalog-cache';
import { FacetCatalogService } from './facet-catalog.service';
import { ListingMapper } from './listing.mapper';
import { ListingRepository } from './listing.repository';
import { parseFilters, serializeFilters } from './listing/listing-filters';
import {
  BRAND_FILTER_KEY,
  DEFAULT_LISTING_PAGE_SIZE,
  DEFAULT_LISTING_SORT,
  ListingCriteria,
  ResolvedGroup,
  SEARCH_SUGGEST_LIMIT,
} from './listing/listing.types';
import { toSearchQuery } from './listing/search-terms';

/** Shared cache lifetime: filtered listings may lag catalog writes by up to this long. */
const LISTING_CACHE_TTL_SECONDS = 60;
/**
 * Unfiltered views (a category or all products, any page or sort) are the ones most shoppers
 * share and the costliest to count (every product in the category), so they live longer.
 */
const UNFILTERED_CACHE_TTL_SECONDS = 300;
/** Bump when the response shape changes, so old cached entries are never served. */
const CACHE_VERSION = 'v2';

interface ResolvedRequest {
  criteria: ListingCriteria;
  category: CategoryListingContextDto | null;
  applied: ListingAppliedDto;
  /** Stable key of the normalised request (equivalent URLs share it). */
  cacheKey: string;
  /** Redis lifetime for this request. */
  ttlSeconds: number;
}

/**
 * The storefront listing (PLP): products, facet counts and price bounds for a category and a
 * set of filters, served from the ProductListing read model.
 *
 * Caching: responses live in Redis for a minute under a key of the NORMALISED request, so
 * reordered values, unknown keys or tracking parameters never split the cache. Concurrent
 * misses for the same key in this process share one database round trip (single-flight).
 * Redis being down only costs the cache, never the request.
 */
@Injectable()
export class ListingService {
  constructor(
    private readonly repository: ListingRepository,
    private readonly facetCatalog: FacetCatalogService,
    private readonly categoryService: CategoryService,
    private readonly mediaService: MediaService,
    private readonly cache: CatalogCache,
  ) {}

  async getListing(query: GetListingQueryDto): Promise<ListingResponseDto> {
    const request = await this.resolve(query);
    return this.cache.get(
      `listing:${CACHE_VERSION}:${request.cacheKey}`,
      request.ttlSeconds,
      async () => {
        const catalog = await this.facetCatalog.get();
        const [rows, aggregates] = await this.repository.findPageAndAggregates(request.criteria);
        const total = ListingMapper.total(aggregates);
        return {
          category: request.category,
          products: rows.map((row) =>
            ListingMapper.toProduct(row, (key) => this.mediaService.getPublicUrl(key)),
          ),
          total,
          page: request.criteria.page,
          limit: request.criteria.limit,
          totalPages: Math.ceil(total / request.criteria.limit),
          facets: ListingMapper.facets(aggregates, catalog, request.criteria),
          price: ListingMapper.price(aggregates, request.criteria),
          applied: request.applied,
        };
      },
    );
  }

  /** Counts only (no products): the mobile filter drawer's live "Show N results". */
  async getFacets(query: GetListingQueryDto): Promise<ListingFacetsResponseDto> {
    const request = await this.resolve(query);
    return this.cache.get(
      `facets:${CACHE_VERSION}:${request.cacheKey}`,
      request.ttlSeconds,
      async () => {
        const catalog = await this.facetCatalog.get();
        const aggregates = await this.repository.findAggregates(request.criteria);
        return {
          total: ListingMapper.total(aggregates),
          facets: ListingMapper.facets(aggregates, catalog, request.criteria),
          price: ListingMapper.price(aggregates, request.criteria),
          applied: request.applied,
        };
      },
    );
  }

  /**
   * Typeahead: the top few products matching every word of the query, across the catalog.
   * A query with no usable word (empty, or only 1-letter words) returns nothing without a query.
   */
  async suggest(query: SearchSuggestQueryDto): Promise<SearchSuggestResponseDto> {
    const q = toSearchQuery(query.q);
    if (!q) return { products: [] };
    const key = createHash('sha1').update(q).digest('hex');
    return this.cache.get(
      `suggest:${CACHE_VERSION}:${key}`,
      LISTING_CACHE_TTL_SECONDS,
      async () => {
        const rows = await this.repository.findSuggestions(q, SEARCH_SUGGEST_LIMIT);
        return {
          products: rows.map((row) =>
            ListingMapper.toProduct(row, (imageKey) => this.mediaService.getPublicUrl(imageKey)),
          ),
        };
      },
    );
  }

  /**
   * Validates and normalises a request: resolves the category, maps filter slugs to option codes and brand ids
   * (dropping unknown keys and values), orders everything canonically and builds the cache key.
   */
  private async resolve(query: GetListingQueryDto): Promise<ResolvedRequest> {
    const selection = parseFilters(query.filters);
    const [category, catalog] = await Promise.all([
      query.category ? this.categoryService.getListingContext(query.category) : null,
      this.facetCatalog.get(),
    ]);

    const groups: ResolvedGroup[] = [];
    const applied = new Map<string, string[]>();
    for (const [key, values] of selection) {
      if (key === BRAND_FILTER_KEY) {
        const brands = values.flatMap((slug) => catalog.brandsBySlug.get(slug) ?? []);
        if (brands.length === 0) continue;
        groups.push({ key, kind: 'brand', ids: brands.map((b) => b.id).sort() });
        applied.set(
          key,
          brands.map((b) => b.slug),
        );
        continue;
      }
      const definition = catalog.definitionsByKey.get(key);
      if (!definition) continue;
      const options = values.flatMap((slug) => definition.optionsBySlug.get(slug) ?? []);
      if (options.length === 0) continue;
      groups.push({ key, kind: 'option', codes: options.map((o) => o.code).sort((a, b) => a - b) });
      applied.set(
        key,
        options.map((o) => o.slug),
      );
    }
    groups.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

    let priceMin = query.priceMin ?? null;
    let priceMax = query.priceMax ?? null;
    if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
      [priceMin, priceMax] = [priceMax, priceMin];
    }
    // Lowercase words, de-duplicated; null when no usable word is left.
    const q = toSearchQuery(query.q);
    const sort = query.sort ?? DEFAULT_LISTING_SORT;
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_LISTING_PAGE_SIZE;
    const filters = serializeFilters(applied);

    const normalised = {
      category: category?.slug ?? null,
      q,
      filters,
      priceMin,
      priceMax,
      sort,
      page,
      limit,
    };

    return {
      criteria: {
        categoryId: category?.id ?? null,
        q,
        priceMin,
        priceMax,
        groups,
        sort,
        page,
        limit,
      },
      category,
      applied: {
        filters,
        sort,
        ...(priceMin !== null && { priceMin }),
        ...(priceMax !== null && { priceMax }),
        ...(q !== null && { q }),
      },
      cacheKey: createHash('sha1').update(JSON.stringify(normalised)).digest('hex'),
      ttlSeconds:
        groups.length === 0 && priceMin === null && priceMax === null && q === null
          ? UNFILTERED_CACHE_TTL_SECONDS
          : LISTING_CACHE_TTL_SECONDS,
    };
  }
}
