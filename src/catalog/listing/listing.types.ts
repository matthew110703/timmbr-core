import { FilterDisplay } from '@prisma/client';

export const LISTING_SORTS = [
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'discount',
] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];
export const DEFAULT_LISTING_SORT: ListingSort = 'relevance';

/** Page sizes divisible by 2, 3 and 4, so grids never end on a ragged row. */
export const LISTING_PAGE_SIZES = [12, 24, 36, 48] as const;
export const DEFAULT_LISTING_PAGE_SIZE = 24;
export const MAX_LISTING_PAGE = 1000;

/** Products shown under the header search box while typing. */
export const SEARCH_SUGGEST_LIMIT = 5;

/** The brand filter is built in (from Product.brandId), not an attribute. */
export const BRAND_FILTER_KEY = 'brand';

/** Facet groups larger than this return their top options by count (plus selected ones). */
export const MAX_FACET_OPTIONS = 50;

/** One filter group after resolving the URL slugs: option codes, or brand ids. */
export type ResolvedGroup =
  | { key: string; kind: 'option'; codes: number[] }
  | { key: string; kind: 'brand'; ids: string[] };

/** A fully resolved listing request: everything the SQL needs. */
export interface ListingCriteria {
  categoryId: string | null;
  /** Search words, normalised by toSearchQuery (lowercase, single spaces). */
  q: string | null;
  priceMin: number | null;
  priceMax: number | null;
  groups: ResolvedGroup[];
  sort: ListingSort;
  page: number;
  limit: number;
}

/** A row of the page query (ProductListing columns the card needs). */
export interface ListingRow {
  productId: string;
  slug: string;
  title: string;
  brandName: string | null;
  price: unknown;
  compareAtPrice: unknown;
  currency: string;
  discountPct: number;
  hasMultipleVariants: boolean;
  inStock: boolean;
  coverImageKey: string | null;
  coverAlt: string | null;
  defaultVariantId: string | null;
}

/** A row of the aggregate query (total, price bounds, option and brand counts). */
export interface AggregateRow {
  kind: 'total' | 'price' | 'opt' | 'brand';
  /** The selected group these counts belong to; null for counts under all filters. */
  grp: string | null;
  id: string | null;
  n: number | null;
  minp: unknown;
  maxp: unknown;
}

/** The facet vocabulary: filterable attributes with their options, and active brands. */
export interface FacetCatalog {
  definitions: FacetDefinition[];
  definitionsByKey: Map<string, FacetDefinition>;
  brands: FacetBrand[];
  brandsBySlug: Map<string, FacetBrand>;
}

export interface FacetDefinition {
  id: string;
  key: string;
  label: string;
  displayType: FilterDisplay;
  options: FacetOption[];
  optionsBySlug: Map<string, FacetOption>;
}

export interface FacetOption {
  id: string;
  /** Compact integer id stored in ProductListing.optionCodes. */
  code: number;
  slug: string;
  label: string;
  swatchHex: string | null;
}

export interface FacetBrand {
  id: string;
  slug: string;
  name: string;
}
