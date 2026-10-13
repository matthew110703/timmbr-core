import { InvalidListingFiltersException } from '@/common/exceptions/catalog.exception';

/**
 * The listing `filters` parameter: groups separated by ";", a key and its values by ":", values
 * by ",". For example  material:teak,walnut;size:king;brand:oakline.
 * Keys and values are URL slugs (lowercase letters, digits, single hyphens).
 */
export const FILTERS_MAX_LENGTH = 1024;
export const FILTERS_MAX_GROUPS = 20;
export const FILTERS_MAX_VALUES_PER_GROUP = 30;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type FilterSelection = Map<string, string[]>;

/** Parses the parameter. Duplicate keys merge, values are de-duplicated; malformed input is a 400. */
export function parseFilters(raw: string | undefined | null): FilterSelection {
  const selection: FilterSelection = new Map();
  if (!raw) return selection;
  if (raw.length > FILTERS_MAX_LENGTH) {
    throw new InvalidListingFiltersException(
      `filters must be at most ${FILTERS_MAX_LENGTH} characters.`,
    );
  }

  for (const segment of raw.split(';')) {
    if (segment.trim() === '') continue;
    const colon = segment.indexOf(':');
    if (colon <= 0) {
      throw new InvalidListingFiltersException(`"${segment}" is not a key:value group.`);
    }
    const key = segment.slice(0, colon).trim();
    if (!SLUG.test(key)) {
      throw new InvalidListingFiltersException(`"${key}" is not a valid filter key.`);
    }
    const values = segment
      .slice(colon + 1)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    for (const value of values) {
      if (!SLUG.test(value)) {
        throw new InvalidListingFiltersException(`"${value}" is not a valid filter value.`);
      }
    }
    const merged = new Set([...(selection.get(key) ?? []), ...values]);
    if (merged.size > FILTERS_MAX_VALUES_PER_GROUP) {
      throw new InvalidListingFiltersException(
        `A filter group can have at most ${FILTERS_MAX_VALUES_PER_GROUP} values.`,
      );
    }
    if (merged.size > 0) selection.set(key, [...merged]);
  }

  if (selection.size > FILTERS_MAX_GROUPS) {
    throw new InvalidListingFiltersException(
      `At most ${FILTERS_MAX_GROUPS} filter groups are allowed.`,
    );
  }
  return selection;
}

/** Canonical form: keys and values sorted, so equivalent selections serialise identically. */
export function serializeFilters(selection: ReadonlyMap<string, readonly string[]>): string {
  return [...selection.entries()]
    .filter(([, values]) => values.length > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, values]) => `${key}:${[...values].sort().join(',')}`)
    .join(';');
}
