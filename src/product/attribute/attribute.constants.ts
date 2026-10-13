/**
 * Query keys the storefront listing uses for itself. A filterable attribute's key becomes a URL
 * key too (`?material=teak`), so it must never collide with these.
 */
export const RESERVED_FILTER_KEYS: ReadonlySet<string> = new Set([
  'brand',
  'category',
  'filters',
  'limit',
  'page',
  'price',
  'priceMax',
  'priceMin',
  'q',
  'sort',
]);

/** Lowercase letters, digits and hyphens: safe in URLs and in the listing `filters` format. */
export const FILTER_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The single option a BOOLEAN attribute has; "true" selects it, "false" selects nothing. */
export const BOOLEAN_TRUE_OPTION = { slug: 'yes', label: 'Yes' } as const;
