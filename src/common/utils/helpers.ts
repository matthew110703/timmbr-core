import slugify from 'slugify';

export const generateSlug = (content: string) => {
  return slugify(content, {
    lower: true,
    strict: true,
    trim: true,
  });
};

/**
 * Items in a stable `variantId` order. Transactions that lock several inventory rows must lock
 * them in the same order, or two concurrent orders for the same variants can deadlock.
 */
export const byVariantId = <T extends { variantId: string | null }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => compareIds(a.variantId ?? '', b.variantId ?? ''));

/** Plain code-point comparison (locale-independent, so every process sorts identically). */
export const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
