/**
 * Query plans and timings of the listing SQL for typical and worst cases, plus API timings
 * (uncached and cached). Use with a large catalog: pnpm db:seed:plp --scale=50000.
 *
 * Run: pnpm listing:explain
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../src/config/env';
import {
  listingAggregateQuery,
  listingPageQuery,
  searchSuggestQuery,
} from '../src/catalog/listing/listing-query.builder';
import { ListingCriteria, ResolvedGroup } from '../src/catalog/listing/listing.types';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
const BASE = `http://localhost:${env.PORT ?? 8000}`;

async function explain(label: string, sql: Prisma.Sql) {
  const plan = await prisma.$queryRaw<{ 'QUERY PLAN': string }[]>(
    Prisma.sql`EXPLAIN (ANALYZE, BUFFERS) ${sql}`,
  );
  const lines = plan.map((r) => r['QUERY PLAN']);
  const time = lines.find((l) => l.startsWith('Execution Time'))?.replace('Execution Time: ', '');
  const scans = [
    ...new Set(
      lines
        .map((l) => l.match(/(Bitmap Index Scan|Index Scan|Index Only Scan|Seq Scan) on (\S+)/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => `${m[1]} ${m[2]}`),
    ),
  ];
  console.log(`  ${label.padEnd(10)} ${String(time).padStart(10)}   ${scans.join(', ')}`);
}

async function main() {
  const total = await prisma.productListing.count();
  console.log(`ProductListing rows: ${total}\n`);

  const root = await prisma.category.findUniqueOrThrow({ where: { slug: 'living-room' } });
  const leaf = await prisma.category.findUniqueOrThrow({ where: { slug: '3-seater-sofas' } });
  const definitions = await prisma.attributeDefinition.findMany({
    where: {
      isFilterable: true,
      productId: null,
      key: { in: ['material', 'size', 'finish', 'style'] },
    },
    include: { options: true },
  });
  const group = (key: string, n: number): ResolvedGroup => {
    const def = definitions.find((d) => d.key === key)!;
    return { key, kind: 'option', codes: def.options.slice(0, n).map((o) => o.code) };
  };
  const base: ListingCriteria = {
    categoryId: root.id,
    q: null,
    priceMin: null,
    priceMax: null,
    groups: [],
    sort: 'relevance',
    page: 1,
    limit: 24,
  };

  const cases: [string, ListingCriteria][] = [
    ['category root, no filters', base],
    [
      'category root, 4 groups selected + price',
      {
        ...base,
        priceMin: 10000,
        priceMax: 90000,
        groups: [group('finish', 2), group('material', 3), group('size', 2), group('style', 2)],
      },
    ],
    ['search inside a category', { ...base, q: 'teak' }],
    ['search, 2 words, all products', { ...base, categoryId: null, q: 'teak bed' }],
    ['leaf category (3-seater sofas)', { ...base, categoryId: leaf.id }],
    [
      'leaf category + 2 groups',
      { ...base, categoryId: leaf.id, groups: [group('finish', 2), group('style', 1)] },
    ],
    ['price sort, deep page (40)', { ...base, sort: 'price_asc', page: 40 }],
    ['all products, newest, page 1', { ...base, categoryId: null, sort: 'newest' }],
  ];

  for (const [name, criteria] of cases) {
    console.log(name);
    await explain('page', listingPageQuery(criteria));
    await explain('aggregate', listingAggregateQuery(criteria));
  }

  console.log('\nsearch suggestions (typeahead)');
  for (const q of ['te', 'teak', 'teak bed', 'oakline sofa walnut']) {
    await explain(q, searchSuggestQuery(q, 5));
  }

  // API: a unique query string defeats the cache for the cold timing; the repeat hits Redis.
  console.log('\nAPI (end to end)');
  const headers = env.CORE_INTERNAL_KEY ? { 'x-internal-key': env.CORE_INTERNAL_KEY } : undefined;
  const time = async (url: string) => {
    const started = performance.now();
    const response = await fetch(url, { headers });
    await response.json();
    return Math.round(performance.now() - started);
  };
  const cold: number[] = [];
  const warm: number[] = [];
  for (let i = 0; i < 5; i++) {
    const url = `${BASE}/api/v1/catalog/listing?category=living-room&filters=material:fabric,teak-wood&priceMin=${1000 + i}`;
    cold.push(await time(url));
    warm.push(await time(url));
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  console.log(`  uncached median ${median(cold)}ms (${cold.join(', ')})`);
  console.log(`  cached   median ${median(warm)}ms (${warm.join(', ')})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
