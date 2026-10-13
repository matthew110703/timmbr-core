/** Words shorter than this match too much (and can't use the trigram index), so they're ignored. */
export const MIN_SEARCH_TERM_LENGTH = 2;
/** More words than this adds cost without narrowing a product catalog any further. */
export const MAX_SEARCH_TERMS = 6;

/**
 * Normalises a search query into the words every result must contain (in its title or brand).
 * Lowercase, de-duplicated, in the order typed. Returns null when no usable word is left, which
 * callers treat as "no search".
 *
 * The normalised query is the words joined by single spaces: it is what the cache key, the
 * relevance ranking and `applied.q` use, so "Teak  Bed" and "teak bed" are one request.
 */
export function toSearchQuery(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const terms = [
    ...new Set(
      raw
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length >= MIN_SEARCH_TERM_LENGTH),
    ),
  ].slice(0, MAX_SEARCH_TERMS);
  return terms.length > 0 ? terms.join(' ') : null;
}

/** The words of a query already normalised by toSearchQuery. */
export function searchTerms(normalised: string): string[] {
  return normalised.split(' ');
}
