/**
 * Checks the ProductListing read model against the catalog tables. Every row is recomputed here
 * in TypeScript, independently of the SQL in refresh_product_listing(), and compared field by
 * field. Exits non-zero on any difference, so it can gate tests and deploys.
 *
 * Run: pnpm listing:verify
 */
import { CategoryStatus, PrismaClient, ProductStatus, VariantStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../src/config/env';

const round2 = (value: number) => Math.round(value * 100) / 100;
const sameArray = (a: (string | number)[], b: (string | number)[]) => {
  const key = (xs: (string | number)[]) => xs.map(String).sort().join(',');
  return a.length === b.length && key(a) === key(b);
};

/** Differences between the read model and the catalog (empty when they match). */
export async function verifyListing(
  prisma: PrismaClient,
): Promise<{ listable: number; problems: string[] }> {
  const [categories, products, listing] = await Promise.all([
    prisma.category.findMany({ select: { id: true, parentId: true, status: true } }),
    prisma.product.findMany({
      include: {
        brand: true,
        images: true,
        attributeValues: { include: { options: { include: { option: true } } } },
        variants: {
          include: {
            inventory: true,
            attributeValues: { include: { options: { include: { option: true } } } },
          },
        },
      },
    }),
    prisma.productListing.findMany(),
  ]);

  // Category paths: root-to-leaf ids when the whole path is active (depth ≤ 10, no cycles).
  const byId = new Map(categories.map((c) => [c.id, c]));
  const pathOf = (id: string): string[] | null => {
    const path: string[] = [];
    let node = byId.get(id);
    while (node) {
      if (node.status !== CategoryStatus.ACTIVE || path.length >= 10 || path.includes(node.id)) {
        return null;
      }
      path.push(node.id);
      node = node.parentId ? byId.get(node.parentId) : undefined;
    }
    return path;
  };

  const expected = new Map<string, Record<string, unknown>>();
  for (const p of products) {
    if (p.status !== ProductStatus.ACTIVE) continue;
    const active = p.variants
      .filter((v) => v.status === VariantStatus.ACTIVE)
      .sort(
        (a, b) =>
          Number(b.isDefault) - Number(a.isDefault) ||
          a.createdAt.getTime() - b.createdAt.getTime() ||
          (a.id < b.id ? -1 : 1),
      );
    const path = pathOf(p.categoryId);
    if (!active.length || !path) continue;
    const dv = active[0];
    if (dv.currency !== 'INR') continue;

    const price = Number(dv.price);
    const compareAt = dv.compareAtPrice === null ? null : Number(dv.compareAtPrice);
    const cover = [...p.images].sort(
      (a, b) =>
        Number(b.isPrimary) - Number(a.isPrimary) ||
        a.sortOrder - b.sortOrder ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        (a.id < b.id ? -1 : 1),
    )[0];
    const optionCodes = new Set<number>();
    p.attributeValues.forEach((av) => av.options.forEach((o) => optionCodes.add(o.option.code)));
    active.forEach((v) =>
      v.attributeValues.forEach((av) => av.options.forEach((o) => optionCodes.add(o.option.code))),
    );
    const brandActive = p.brand?.status === 'ACTIVE';

    expected.set(p.id, {
      slug: p.slug,
      title: p.title,
      brandId: brandActive ? p.brand!.id : null,
      brandName: brandActive ? p.brand!.name : null,
      searchText: `${p.title} ${brandActive ? p.brand!.name : ''}`
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase(),
      defaultVariantId: dv.id,
      categoryId: p.categoryId,
      categoryPath: path,
      price: round2(price),
      compareAtPrice: compareAt !== null && compareAt > price ? round2(compareAt) : null,
      currency: dv.currency,
      discountPct:
        compareAt !== null && compareAt > price && compareAt > 0
          ? Math.floor(((compareAt - price) * 100) / compareAt)
          : 0,
      hasMultipleVariants: active.length > 1,
      inStock: active.some(
        (v) => v.inventory !== null && v.inventory.quantity - v.inventory.reservedQuantity > 0,
      ),
      coverImageKey: cover?.storageKey ?? null,
      coverAlt: cover?.altText ?? null,
      optionCodes: [...optionCodes],
      createdAt: p.createdAt.getTime(),
    });
  }

  const problems: string[] = [];
  const actual = new Map(listing.map((row) => [row.productId, row]));
  for (const [id, want] of expected) {
    const row = actual.get(id);
    if (!row) {
      problems.push(`missing row for listable product ${String(want.slug)}`);
      continue;
    }
    const got: Record<string, unknown> = {
      ...row,
      price: round2(Number(row.price)),
      compareAtPrice: row.compareAtPrice === null ? null : round2(Number(row.compareAtPrice)),
      createdAt: row.createdAt.getTime(),
    };
    for (const [field, value] of Object.entries(want)) {
      const ok = Array.isArray(value)
        ? sameArray(value as (string | number)[], got[field] as (string | number)[])
        : value === got[field];
      if (!ok) {
        problems.push(
          `${String(want.slug)}.${field}: expected ${JSON.stringify(value)}, got ${JSON.stringify(got[field])}`,
        );
      }
    }
  }
  for (const row of listing) {
    if (!expected.has(row.productId)) problems.push(`stale row for unlistable product ${row.slug}`);
    if (row.currency !== 'INR') problems.push(`non-INR listing row ${row.slug} (${row.currency})`);
  }

  return { listable: expected.size, problems };
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });
  try {
    const { listable, problems } = await verifyListing(prisma);
    if (problems.length) {
      console.error(`✗ ProductListing differs from the catalog (${problems.length}):`);
      problems.slice(0, 50).forEach((p) => console.error(`  - ${p}`));
      process.exitCode = 1;
    } else {
      console.log(`✓ ProductListing matches the catalog: ${listable} listable products`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
