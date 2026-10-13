/**
 * Oracle test for GET /catalog/listing: sends random requests (category, filters, price, search,
 * sort, page) to a running API and compares each response with a brute-force computation over
 * the ProductListing rows: products and their order, total, every facet count, price bounds.
 *
 * Needs the API running (pnpm start:dev) and the demo catalog. Sends the internal key, so the
 * requests also check that trusted clients aren't rate limited.
 *
 * Run: pnpm listing:oracle [--runs=200] [--base=http://localhost:8000]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../src/config/env';
import { niceRange } from '../src/catalog/listing/price-range';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const RUNS = Number(arg('runs') ?? 200);
const BASE = arg('base') ?? `http://localhost:${env.PORT ?? 8000}`;
const SORTS = ['relevance', 'newest', 'price_asc', 'price_desc', 'discount'] as const;

let seed = 7;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)];

interface Row {
  productId: string;
  title: string;
  /** Title + brand, lowercase: what every search word must appear in. */
  text: string;
  brandId: string | null;
  categoryPath: string[];
  price: number;
  discountPct: number;
  inStock: boolean;
  optionCodes: number[];
  createdAt: number;
}

interface ApiFacet {
  key: string;
  options: { value: string; count: number; selected: boolean }[];
}
interface ApiListing {
  products: { id: string }[];
  total: number;
  totalPages: number;
  facets: ApiFacet[];
  price: { min: number; max: number; step: number };
}

async function main() {
  const [listing, definitions, brands, categories] = await Promise.all([
    prisma.productListing.findMany(),
    prisma.attributeDefinition.findMany({
      where: { isFilterable: true, productId: null, key: { not: null } },
      include: { options: true },
    }),
    prisma.brand.findMany({ where: { status: 'ACTIVE' } }),
    prisma.category.findMany({ where: { status: 'ACTIVE' } }),
  ]);
  const rows: Row[] = listing.map((r) => ({
    productId: r.productId,
    title: r.title,
    text: `${r.title} ${r.brandName ?? ''}`.toLowerCase(),
    brandId: r.brandId,
    categoryPath: r.categoryPath,
    price: Number(r.price),
    discountPct: r.discountPct,
    inStock: r.inStock,
    optionCodes: r.optionCodes,
    createdAt: r.createdAt.getTime(),
  }));
  const usedCategories = categories.filter((c) => rows.some((r) => r.categoryPath.includes(c.id)));
  const words = [...new Set(rows.flatMap((r) => r.text.split(/\s+/)))].filter((w) => w.length >= 3);

  let mismatches = 0;
  for (let run = 0; run < RUNS; run++) {
    // ---- a random request ----
    const category = rand() < 0.7 ? pick(usedCategories) : null;
    const groups = new Map<string, string[]>();
    for (const def of definitions) {
      if (rand() < 0.25) {
        const values = [pick(def.options).slug];
        if (rand() < 0.4) values.push(pick(def.options).slug);
        if (rand() < 0.1) values.push('no-such-value');
        groups.set(def.key!, [...new Set(values)]);
      }
    }
    if (rand() < 0.2) groups.set('brand', [pick(brands).slug]);
    const priceMin = rand() < 0.2 ? Math.floor(rand() * 60) * 1000 : null;
    const priceMax = rand() < 0.2 ? 40000 + Math.floor(rand() * 100) * 1000 : null;
    // One or two words (any case, sometimes with a 1-letter word the API must ignore).
    const q =
      rand() < 0.2
        ? [pick(words), ...(rand() < 0.5 ? [pick(words)] : []), ...(rand() < 0.2 ? ['a'] : [])]
            .map((w) => (rand() < 0.3 ? w.toUpperCase() : w))
            .join('  ')
        : null;
    const terms = q
      ? q
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length >= 2)
      : [];
    const sort = pick([...SORTS]);
    const limit = pick([12, 24]);
    const page = pick([1, 1, 2, 3]);

    const params = new URLSearchParams({ sort, limit: String(limit), page: String(page) });
    if (category) params.set('category', category.slug);
    if (groups.size)
      params.set('filters', [...groups].map(([k, v]) => `${k}:${v.join(',')}`).join(';'));
    if (priceMin !== null) params.set('priceMin', String(priceMin));
    if (priceMax !== null) params.set('priceMax', String(priceMax));
    if (q) params.set('q', q);

    // ---- brute force ----
    const known = new Map<string, Set<string | number>>(); // key → brand ids / option codes
    for (const [key, slugs] of groups) {
      const ids: (string | number)[] =
        key === 'brand'
          ? brands.filter((b) => slugs.includes(b.slug)).map((b) => b.id)
          : (definitions.find((d) => d.key === key)?.options ?? [])
              .filter((o) => slugs.includes(o.slug))
              .map((o) => o.code);
      if (ids.length) known.set(key, new Set(ids));
    }
    const [lo, hi] =
      priceMin !== null && priceMax !== null && priceMin > priceMax
        ? [priceMax, priceMin]
        : [priceMin, priceMax];
    const matches = (r: Row, skip?: string, skipPrice = false) =>
      (!category || r.categoryPath.includes(category.id)) &&
      terms.every((t) => r.text.includes(t)) &&
      (skipPrice || ((lo === null || r.price >= lo) && (hi === null || r.price <= hi))) &&
      [...known].every(
        ([key, ids]) =>
          key === skip ||
          (key === 'brand'
            ? r.brandId !== null && ids.has(r.brandId)
            : r.optionCodes.some((o) => ids.has(o))),
      );

    const hits = rows.filter((r) => matches(r));
    const key = (r: Row): number =>
      sort === 'price_asc'
        ? r.price
        : sort === 'price_desc'
          ? -r.price
          : sort === 'discount'
            ? -r.discountPct
            : -r.createdAt;
    hits.sort(
      (a, b) =>
        Number(b.inStock) - Number(a.inStock) ||
        key(a) - key(b) ||
        (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0),
    );
    const expectedPage = hits.slice((page - 1) * limit, page * limit).map((r) => r.productId);

    // ---- compare ----
    const response = await fetch(`${BASE}/api/v1/catalog/listing?${params}`, {
      headers: env.CORE_INTERNAL_KEY ? { 'x-internal-key': env.CORE_INTERNAL_KEY } : {},
    });
    if (!response.ok) {
      mismatches++;
      console.error(`✗ #${run} HTTP ${response.status} for ?${params}`);
      continue;
    }
    const api = ((await response.json()) as { data: ApiListing }).data;
    const problems: string[] = [];

    if (api.total !== hits.length) problems.push(`total ${api.total} ≠ ${hits.length}`);
    const apiPage = api.products.map((p) => p.id);
    // A search orders by word similarity, which only Postgres computes: compare page sizes.
    const samePage =
      q && sort === 'relevance'
        ? apiPage.length === expectedPage.length
        : apiPage.join() === expectedPage.join();
    if (!samePage)
      problems.push(`page differs (${apiPage.length} vs ${expectedPage.length} items)`);

    for (const def of definitions) {
      const facet = api.facets.find((f) => f.key === def.key);
      for (const option of def.options) {
        const want = rows.filter(
          (r) =>
            matches(r, known.has(def.key!) ? def.key! : undefined) &&
            r.optionCodes.includes(option.code),
        ).length;
        const got = facet?.options.find((o) => o.value === option.slug)?.count ?? 0;
        if (want !== got) problems.push(`${def.key}:${option.slug} count ${got} ≠ ${want}`);
      }
    }
    const brandFacet = api.facets.find((f) => f.key === 'brand');
    for (const brand of brands) {
      const want = rows.filter(
        (r) => matches(r, known.has('brand') ? 'brand' : undefined) && r.brandId === brand.id,
      ).length;
      const got = brandFacet?.options.find((o) => o.value === brand.slug)?.count ?? 0;
      if (want !== got) problems.push(`brand:${brand.slug} count ${got} ≠ ${want}`);
    }

    const priced = rows.filter((r) => matches(r, undefined, true)).map((r) => r.price);
    const range = priced.length
      ? niceRange(Math.min(...priced), Math.max(...priced))
      : { min: 0, max: 0, step: 0 };
    if (
      api.price.min !== range.min ||
      api.price.max !== range.max ||
      api.price.step !== range.step
    ) {
      problems.push(`price ${JSON.stringify(api.price)} ≠ ${JSON.stringify(range)}`);
    }

    if (problems.length) {
      mismatches++;
      console.error(`✗ #${run} ?${params}\n    ${problems.slice(0, 6).join('\n    ')}`);
    }
  }

  if (mismatches) {
    console.error(`\n✗ ${mismatches}/${RUNS} requests differ from the oracle`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${RUNS}/${RUNS} random listing requests match the oracle`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
