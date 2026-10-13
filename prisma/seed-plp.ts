/**
 * Development data for the storefront listing (PLP): the shared filter vocabulary, ~150 demo
 * products across beds, sofas, dining, chairs and sideboards, and the listing banner (CMS).
 *
 * - Filterable global attributes with options: Material, Size, Storage, Storage Type, Style,
 *   Finish (swatches, the one variant-level filter), Fast Delivery and Clearance Sale (toggles).
 * - Demo products have "demo-" slugs and fictional brands, reuse the product images already in
 *   R2, and are deterministic: the same run always produces the same catalog.
 * - Idempotent: demo products are purged and recreated in one transaction, with listing sync
 *   switched off for the bulk insert and a single listing rebuild at the end.
 *
 * Run:  pnpm db:seed:plp                 (vocabulary + 150 demo products + banner)
 *       pnpm db:seed:plp --scale=50000   (adds a large set for performance testing)
 *       pnpm db:seed:plp --purge         (removes every demo product)
 */
import { randomUUID } from 'node:crypto';
import {
  AttributeScope,
  AttributeType,
  FilterDisplay,
  Prisma,
  PrismaClient,
  ProductStatus,
  VariantStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../src/config/env';
import { generateSlug } from '../src/common/utils/helpers';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

const DEMO_PREFIX = 'demo-';
const args = process.argv.slice(2);
const PURGE_ONLY = args.includes('--purge');
const SCALE = Number(args.find((a) => a.startsWith('--scale='))?.split('=')[1] ?? 0);

// ---------------------------------------------------------------------------------------------
// Deterministic randomness (mulberry32), so every run builds the same catalog.
// ---------------------------------------------------------------------------------------------
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
    sample: <T>(items: readonly T[], n: number): T[] => {
      const pool = [...items];
      const out: T[] = [];
      while (out.length < n && pool.length)
        out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
      return out;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Filter vocabulary.
// ---------------------------------------------------------------------------------------------
interface OptionSeed {
  slug: string;
  label: string;
  swatchHex?: string;
}
interface DefinitionSeed {
  key: string;
  name: string;
  type: AttributeType;
  scope: AttributeScope;
  displayType: FilterDisplay;
  filterOrder: number;
  options: OptionSeed[];
}

const opt = (label: string, swatchHex?: string): OptionSeed => ({
  slug: generateSlug(label),
  label,
  ...(swatchHex && { swatchHex }),
});

const DEFINITIONS: DefinitionSeed[] = [
  {
    key: 'fast-delivery',
    name: 'Fast Delivery',
    type: AttributeType.BOOLEAN,
    scope: AttributeScope.PRODUCT,
    displayType: FilterDisplay.TOGGLE,
    filterOrder: 1,
    options: [{ slug: 'yes', label: 'Yes' }],
  },
  {
    key: 'clearance',
    name: 'Clearance Sale',
    type: AttributeType.BOOLEAN,
    scope: AttributeScope.PRODUCT,
    displayType: FilterDisplay.TOGGLE,
    filterOrder: 2,
    options: [{ slug: 'yes', label: 'Yes' }],
  },
  {
    key: 'material',
    name: 'Material',
    type: AttributeType.STRING,
    scope: AttributeScope.PRODUCT,
    displayType: FilterDisplay.CHECKBOX,
    filterOrder: 10,
    options: [
      'Sheesham Wood',
      'Teak Wood',
      'Mango Wood',
      'Oak Wood',
      'Ash Wood',
      'Engineered Wood',
      'Fabric',
      'Leather',
    ].map((l) => opt(l)),
  },
  {
    key: 'size',
    name: 'Size',
    type: AttributeType.STRING,
    scope: AttributeScope.PRODUCT,
    displayType: FilterDisplay.CHECKBOX,
    filterOrder: 20,
    options: ['King Size', 'Queen Size', 'Single Size', '2 Seater', '3 Seater', 'L-Shape'].map(
      (l) => opt(l),
    ),
  },
  {
    key: 'storage',
    name: 'Storage',
    type: AttributeType.STRING,
    scope: AttributeScope.PRODUCT,
    displayType: FilterDisplay.CHECKBOX,
    filterOrder: 30,
    options: [opt('With Storage'), opt('Without Storage')],
  },
  {
    key: 'storage-type',
    name: 'Storage Type',
    type: AttributeType.STRING,
    scope: AttributeScope.PRODUCT,
    displayType: FilterDisplay.CHECKBOX,
    filterOrder: 40,
    options: [opt('Hydraulic Storage'), opt('Box Storage'), opt('Drawer Storage')],
  },
  {
    key: 'finish',
    name: 'Finish',
    type: AttributeType.STRING,
    scope: AttributeScope.VARIANT,
    displayType: FilterDisplay.SWATCH,
    filterOrder: 50,
    options: [
      opt('Walnut Finish', '#5C3A21'),
      opt('Honey Finish', '#B5753A'),
      opt('Teak Finish', '#8B5A2B'),
      opt('Natural Finish', '#D9B98B'),
      opt('White Finish', '#E9E4DC'),
      opt('Frosty White Finish', '#F7F6F2'),
    ],
  },
  {
    key: 'style',
    name: 'Style',
    type: AttributeType.STRING,
    scope: AttributeScope.PRODUCT,
    displayType: FilterDisplay.CHECKBOX,
    filterOrder: 60,
    options: [opt('Modern'), opt('Traditional'), opt('Mid-Century'), opt('Scandinavian')],
  },
];

// ---------------------------------------------------------------------------------------------
// Product families: categories, wording, images and which attributes apply.
// ---------------------------------------------------------------------------------------------
const IMAGES = {
  bed: [
    'products/kyoto-floating-walnut-platform-bed/images/queen-walnut-hero.jpg',
    'products/kyoto-floating-walnut-platform-bed/images/bedroom-view.jpg',
    'products/kyoto-floating-walnut-platform-bed/images/headboard-nightstand.jpg',
  ],
  sofa: [
    'products/soren-mid-century-3-seater-sofa/images/cognac-leather-hero.jpg',
    'products/soren-mid-century-3-seater-sofa/images/mineral-grey-linen.jpg',
    'products/soren-mid-century-3-seater-sofa/images/forest-emerald-velvet.jpg',
    'products/soren-mid-century-3-seater-sofa/images/sunlit-living-room.jpg',
  ],
  dining: [
    'products/nordic-minimalist-oak-dining-table/images/hero.jpg',
    'products/nordic-minimalist-oak-dining-table/images/styled.jpg',
    'products/nordic-minimalist-oak-dining-table/images/detail-grain.jpg',
  ],
  chair: [
    'products/koto-boucle-curved-accent-chair/images/oatmeal-hero.jpg',
    'products/koto-boucle-curved-accent-chair/images/charcoal-variant.jpg',
    'products/koto-boucle-curved-accent-chair/images/back-curve.jpg',
  ],
  sideboard: [
    'products/aura-fluted-solid-ash-sideboard/images/blonde-ash-hero.jpg',
    'products/aura-fluted-solid-ash-sideboard/images/dark-espresso-variant.jpg',
    'products/aura-fluted-solid-ash-sideboard/images/fluted-wood-detail.jpg',
  ],
} as const;

const WOODS = [
  'sheesham-wood',
  'teak-wood',
  'mango-wood',
  'oak-wood',
  'ash-wood',
  'engineered-wood',
];

interface Family {
  key: keyof typeof IMAGES;
  count: number;
  categories: string[];
  noun: (category: string) => string;
  price: [number, number];
  material: (category: string, r: ReturnType<typeof rng>) => string;
  size?: (category: string, r: ReturnType<typeof rng>) => string;
  storage?: (category: string, r: ReturnType<typeof rng>) => string | null;
}

const FAMILIES: Family[] = [
  {
    key: 'bed',
    count: 40,
    categories: ['king-size-beds', 'queen-size-beds', 'storage-beds', 'single-beds'],
    noun: () => 'Bed',
    price: [14999, 99999],
    material: (_, r) => r.pick(WOODS),
    size: (category, r) =>
      category === 'king-size-beds'
        ? 'king-size'
        : category === 'queen-size-beds'
          ? 'queen-size'
          : category === 'single-beds'
            ? 'single-size'
            : r.pick(['king-size', 'queen-size']),
    storage: (category, r) =>
      category === 'storage-beds' || r.chance(0.4) ? 'with-storage' : 'without-storage',
  },
  {
    key: 'sofa',
    count: 40,
    categories: [
      '3-seater-sofas',
      '2-seater-sofas',
      'l-shaped-sofas',
      'fabric-sofas',
      'leather-sofas',
      'wooden-sofas',
    ],
    noun: () => 'Sofa',
    price: [19999, 149999],
    material: (category, r) =>
      category === 'fabric-sofas'
        ? 'fabric'
        : category === 'leather-sofas'
          ? 'leather'
          : category === 'wooden-sofas'
            ? r.pick(['teak-wood', 'sheesham-wood', 'mango-wood'])
            : r.pick(['fabric', 'leather', 'fabric']),
    size: (category, r) =>
      category === '3-seater-sofas'
        ? '3-seater'
        : category === '2-seater-sofas'
          ? '2-seater'
          : category === 'l-shaped-sofas'
            ? 'l-shape'
            : r.pick(['2-seater', '3-seater']),
  },
  {
    key: 'dining',
    count: 30,
    categories: [
      '4-seater-dining-sets',
      '6-seater-dining-sets',
      'extendable-dining-tables',
      'round-dining-tables',
    ],
    noun: (category) => (category.includes('sets') ? 'Dining Set' : 'Dining Table'),
    price: [12999, 119999],
    material: (_, r) => r.pick(WOODS.filter((w) => w !== 'engineered-wood')),
  },
  {
    key: 'chair',
    count: 25,
    categories: ['wing-chairs', 'lounge-chairs', 'barrel-chairs'],
    noun: (category) =>
      category === 'wing-chairs'
        ? 'Wing Chair'
        : category === 'lounge-chairs'
          ? 'Lounge Chair'
          : 'Barrel Chair',
    price: [4999, 44999],
    material: (_, r) => r.pick(['fabric', 'leather', 'teak-wood', 'ash-wood']),
  },
  {
    key: 'sideboard',
    count: 15,
    categories: ['sideboards-and-buffets'],
    noun: () => 'Sideboard',
    price: [11999, 84999],
    material: (_, r) => r.pick(WOODS),
    storage: () => 'with-storage',
  },
];

const NAMES = [
  'Arden',
  'Kyoto',
  'Halden',
  'Mira',
  'Sora',
  'Veda',
  'Noor',
  'Aster',
  'Linden',
  'Orra',
  'Tavi',
  'Ivo',
  'Kael',
  'Rune',
  'Elm',
  'Saga',
  'Juno',
  'Cove',
  'Lumi',
  'Pax',
  'Wren',
  'Isla',
  'Brio',
  'Hale',
  'Nova',
  'Tilde',
  'Ember',
  'Fern',
  'Glen',
  'Oslo',
];
const BRANDS = [
  { slug: 'oakline', name: 'Oakline' },
  { slug: 'hearth-and-grain', name: 'Hearth & Grain' },
  { slug: 'timmbr-atelier', name: 'Timmbr Atelier' },
];

/** Prices end in 999, as furniture prices do. */
const nicePrice = (value: number) => Math.max(999, Math.round(value / 1000) * 1000 - 1);

// ---------------------------------------------------------------------------------------------
// Steps.
// ---------------------------------------------------------------------------------------------
async function seedVocabulary() {
  const definitions = new Map<string, { id: string; options: Map<string, string> }>();
  for (const def of DEFINITIONS) {
    const existing = await prisma.attributeDefinition.findFirst({
      where: { key: def.key, productId: null },
    });
    const data = {
      name: def.name,
      type: def.type,
      scope: def.scope,
      displayType: def.displayType,
      filterOrder: def.filterOrder,
      isFilterable: true,
    };
    const saved = existing
      ? await prisma.attributeDefinition.update({ where: { id: existing.id }, data })
      : await prisma.attributeDefinition.create({ data: { ...data, key: def.key } });

    const options = new Map<string, string>();
    for (const [index, option] of def.options.entries()) {
      const row = await prisma.attributeOption.upsert({
        where: { definitionId_slug: { definitionId: saved.id, slug: option.slug } },
        update: { label: option.label, swatchHex: option.swatchHex ?? null, sortOrder: index },
        create: {
          definitionId: saved.id,
          slug: option.slug,
          label: option.label,
          swatchHex: option.swatchHex ?? null,
          sortOrder: index,
        },
      });
      options.set(option.slug, row.id);
    }
    definitions.set(def.key, { id: saved.id, options });
  }
  console.log(`✓ ${definitions.size} filterable attributes with options`);
  return definitions;
}

async function seedBrands() {
  const ids: string[] = [];
  for (const brand of BRANDS) {
    const row = await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: { name: brand.name },
      create: brand,
    });
    ids.push(row.id);
  }
  console.log(`✓ ${ids.length} demo brands`);
  return ids;
}

async function purgeDemoProducts() {
  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('timmbr.listing_sync', 'off', true)`;
      // Set-based deletes over the demo ids (one statement per table, whatever the count).
      await tx.$executeRaw`
        CREATE TEMP TABLE demo_products ON COMMIT DROP AS
        SELECT id FROM "Product" WHERE slug LIKE ${`${DEMO_PREFIX}%`}`;
      await tx.$executeRaw`
        CREATE TEMP TABLE demo_variants ON COMMIT DROP AS
        SELECT id FROM "ProductVariant" WHERE "productId" IN (SELECT id FROM demo_products)`;
      await tx.$executeRaw`DELETE FROM "CartItem" WHERE "productId" IN (SELECT id FROM demo_products)`;
      await tx.$executeRaw`
        DELETE FROM "InventoryTransaction" WHERE "inventoryId" IN (
          SELECT id FROM "Inventory" WHERE "variantId" IN (SELECT id FROM demo_variants))`;
      await tx.$executeRaw`DELETE FROM "Inventory" WHERE "variantId" IN (SELECT id FROM demo_variants)`;
      await tx.$executeRaw`DELETE FROM "ProductImage" WHERE "productId" IN (SELECT id FROM demo_products)`;
      await tx.$executeRaw`
        DELETE FROM "AttributeValue"
        WHERE "productId" IN (SELECT id FROM demo_products)
           OR "variantId" IN (SELECT id FROM demo_variants)`;
      await tx.$executeRaw`DELETE FROM "ProductVariant" WHERE id IN (SELECT id FROM demo_variants)`;
      const count =
        await tx.$executeRaw`DELETE FROM "Product" WHERE id IN (SELECT id FROM demo_products)`;
      console.log(`✓ Purged ${count} demo products`);
    },
    { timeout: 600_000, maxWait: 30_000 },
  );
}

interface Rows {
  products: Prisma.ProductCreateManyInput[];
  variants: Prisma.ProductVariantCreateManyInput[];
  inventory: Prisma.InventoryCreateManyInput[];
  images: Prisma.ProductImageCreateManyInput[];
  values: Prisma.AttributeValueCreateManyInput[];
  valueOptions: Prisma.AttributeValueOptionCreateManyInput[];
}

/** Builds `count` products per family share. `start` keeps slugs and SKUs unique across runs. */
function buildProducts(
  total: number,
  start: number,
  slugPrefix: string,
  categories: Map<string, string>,
  vocabulary: Awaited<ReturnType<typeof seedVocabulary>>,
  brandIds: string[],
): Rows {
  const r = rng(20261012 + start);
  const rows: Rows = {
    products: [],
    variants: [],
    inventory: [],
    images: [],
    values: [],
    valueOptions: [],
  };
  const familyTotal = FAMILIES.reduce((sum, f) => sum + f.count, 0);
  const label = (key: string, slug: string) =>
    DEFINITIONS.find((d) => d.key === key)!.options.find((o) => o.slug === slug)!.label;

  const addValue = (
    key: string,
    slugs: string[],
    target: { productId?: string; variantId?: string },
  ) => {
    const def = vocabulary.get(key)!;
    const id = randomUUID();
    const type = DEFINITIONS.find((d) => d.key === key)!.type;
    rows.values.push({
      id,
      definitionId: def.id,
      value: type === AttributeType.BOOLEAN ? 'true' : label(key, slugs[0]),
      ...target,
    });
    for (const slug of slugs)
      rows.valueOptions.push({ attributeValueId: id, optionId: def.options.get(slug)! });
  };

  let n = start;
  for (const family of FAMILIES) {
    const count = Math.round((family.count / familyTotal) * total);
    for (let i = 0; i < count; i++, n++) {
      const categorySlug = family.categories[i % family.categories.length];
      const categoryId = categories.get(categorySlug);
      if (!categoryId) continue;

      const material = family.material(categorySlug, r);
      const size = family.size?.(categorySlug, r);
      const storage = family.storage?.(categorySlug, r) ?? null;
      const style = r.pick(DEFINITIONS.find((d) => d.key === 'style')!.options).slug;
      const name = `${r.pick(NAMES)} ${label('material', material).replace(' Wood', '')}`;
      const title = `${name} ${size && family.key === 'bed' ? `${label('size', size)} ` : ''}${family.noun(categorySlug)}`;
      const productId = randomUUID();
      const createdAt = new Date(
        Date.UTC(2026, 0, 1) + (n % 270) * 86_400_000 + r.int(0, 86_399) * 1000,
      );

      rows.products.push({
        id: productId,
        title,
        slug: `${slugPrefix}${generateSlug(title)}-${n}`,
        shortDescription: `${title}, handcrafted in solid wood and finished to last.`,
        description: `The ${title} pairs ${label('material', material).toLowerCase()} with a ${label('style', style).toLowerCase()} silhouette.`,
        status: ProductStatus.ACTIVE,
        categoryId,
        brandId: r.chance(0.9) ? r.pick(brandIds) : null,
        createdAt,
      });

      addValue('material', [material], { productId });
      addValue('style', [style], { productId });
      if (size) addValue('size', [size], { productId });
      if (storage) {
        addValue('storage', [storage], { productId });
        if (storage === 'with-storage' && family.key !== 'sofa') {
          addValue(
            'storage-type',
            [r.pick(['hydraulic-storage', 'box-storage', 'drawer-storage'])],
            { productId },
          );
        }
      }
      if (r.chance(0.3)) addValue('fast-delivery', ['yes'], { productId });
      if (r.chance(0.15)) addValue('clearance', ['yes'], { productId });

      const images = IMAGES[family.key];
      const cover = r.int(0, images.length - 1);
      // Every image of the family, starting from a random cover (the product page gallery).
      images
        .map((_, i) => images[(cover + i) % images.length])
        .forEach((storageKey, sortOrder) =>
          rows.images.push({
            id: randomUUID(),
            productId,
            storageKey,
            altText: title,
            sortOrder,
            isPrimary: sortOrder === 0,
            createdAt,
          }),
        );

      const base = r.int(family.price[0], family.price[1]);
      const discounted = r.chance(0.6);
      const outOfStock = r.chance(0.12);
      const finishes = r.sample(DEFINITIONS.find((d) => d.key === 'finish')!.options, r.int(1, 3));
      finishes.forEach((finish, index) => {
        const variantId = randomUUID();
        const price = nicePrice(base * (1 + index * 0.06));
        rows.variants.push({
          id: variantId,
          productId,
          sku: `DEMO-${n}-${index + 1}`,
          price,
          compareAtPrice: discounted ? nicePrice(price * (1.2 + r.next() * 0.8)) : null,
          currency: 'INR',
          isDefault: index === 0,
          status: VariantStatus.ACTIVE,
          createdAt: new Date(createdAt.getTime() + index * 1000),
        });
        rows.inventory.push({
          id: randomUUID(),
          variantId,
          quantity: outOfStock ? 0 : index === 0 ? r.int(1, 25) : r.int(0, 25),
          reservedQuantity: 0,
        });
        addValue('finish', [finish.slug], { variantId });
      });
    }
  }
  return rows;
}

async function insert(rows: Rows) {
  await prisma.$transaction(
    async (tx) => {
      // Skip the per-statement listing refresh; one rebuild runs after the commit.
      await tx.$queryRaw`SELECT set_config('timmbr.listing_sync', 'off', true)`;
      await tx.product.createMany({ data: rows.products });
      await tx.productVariant.createMany({ data: rows.variants });
      await tx.inventory.createMany({ data: rows.inventory });
      await tx.productImage.createMany({ data: rows.images });
      await tx.attributeValue.createMany({ data: rows.values });
      await tx.attributeValueOption.createMany({ data: rows.valueOptions });
    },
    { timeout: 600_000, maxWait: 30_000 },
  );
  console.log(
    `✓ ${rows.products.length} products, ${rows.variants.length} variants, ${rows.values.length} attribute values`,
  );
}

async function seedBanner() {
  const page = await prisma.page.upsert({
    where: { slug: 'catalog' },
    update: {},
    create: {
      slug: 'catalog',
      title: 'Catalog',
      description:
        'Content for the catalog pages: listings (/products, /category/<slug>) and product pages.',
    },
  });
  const data = {
    show: true,
    sortOrder: 0,
    title: 'Crafted for comfort. Designed to belong.',
    description: 'Timeless solid-wood furniture, thoughtfully crafted for the moments that matter.',
    imageUrl: 'https://pub-dc2a8fc90be54a65b2d2000bed9fc8d2.r2.dev/cms/hero.png',
    imageAlt: 'A sunlit living room with a solid-wood sofa and coffee table',
    badges: [
      { label: 'Solid wood, built to last' },
      { label: 'Premium fabrics, made for comfort' },
      { label: 'Timeless designs for every home' },
    ],
  };
  await prisma.pageSection.upsert({
    where: { pageId_type: { pageId: page.id, type: 'plp-banner' } },
    update: { data },
    create: { pageId: page.id, type: 'plp-banner', data },
  });

  // Product page promises under Add to cart. `icon` is a key the storefront maps to an icon.
  const trust = {
    show: true,
    sortOrder: 1,
    items: [
      { icon: 'shipping', label: 'Free shipping*' },
      { icon: 'warranty', label: '60 months warranty*' },
      { icon: 'installation', label: 'Free installation*' },
      { icon: 'emi', label: 'No-cost EMI' },
    ],
    note: '*On orders above ₹10,000. Warranty covers manufacturing defects.',
  };
  await prisma.pageSection.upsert({
    where: { pageId_type: { pageId: page.id, type: 'pdp-trust' } },
    update: { data: trust },
    create: { pageId: page.id, type: 'pdp-trust', data: trust },
  });
  console.log('✓ CMS page "catalog" with the plp-banner and pdp-trust sections');
}

async function main() {
  await purgeDemoProducts();
  if (PURGE_ONLY) {
    await prisma.$executeRaw`SELECT refresh_product_listing(NULL)`;
    return;
  }

  const vocabulary = await seedVocabulary();
  const brandIds = await seedBrands();
  const categories = new Map(
    (await prisma.category.findMany({ select: { id: true, slug: true } })).map((c) => [
      c.slug,
      c.id,
    ]),
  );
  const missing = FAMILIES.flatMap((f) => f.categories).filter((slug) => !categories.has(slug));
  if (missing.length) {
    console.warn(
      `! Missing categories (run prisma/seed-categories.ts first): ${missing.join(', ')}`,
    );
  }

  await insert(buildProducts(150, 1, DEMO_PREFIX, categories, vocabulary, brandIds));
  if (SCALE > 0) {
    const batch = 5000;
    for (let start = 0; start < SCALE; start += batch) {
      await insert(
        buildProducts(
          Math.min(batch, SCALE - start),
          100_000 + start,
          `${DEMO_PREFIX}scale-`,
          categories,
          vocabulary,
          brandIds,
        ),
      );
    }
  }

  console.time('✓ Listing rebuilt');
  await prisma.$executeRaw`SELECT refresh_product_listing(NULL)`;
  console.timeEnd('✓ Listing rebuilt');

  await seedBanner();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
