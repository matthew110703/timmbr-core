/**
 * Exercises the ProductListing triggers against a real database: performs each kind of catalog
 * write, checks the read model with verifyListing() after every step, then restores the data.
 * Also runs two concurrent writers on the same product (lost-update / deadlock check).
 *
 * Needs the demo catalog (pnpm db:seed:plp). Run: pnpm listing:scenarios
 */
import { CategoryStatus, PrismaClient, ProductStatus, VariantStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../src/config/env';
import { verifyListing } from './listing-verify';

const connect = () =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
const prisma = connect();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let failures = 0;
async function check(name: string, expectation?: () => Promise<string | null>) {
  const { problems } = await verifyListing(prisma);
  const extra = expectation ? await expectation() : null;
  if (problems.length || extra) {
    failures++;
    console.error(`✗ ${name}`);
    [...problems.slice(0, 10), ...(extra ? [extra] : [])].forEach((p) => console.error(`    ${p}`));
  } else {
    console.log(`✓ ${name}`);
  }
}

const listingOf = (productId: string) => prisma.productListing.findUnique({ where: { productId } });

async function main() {
  // A demo product with several variants and stock, so every scenario applies.
  const sample = await prisma.productListing.findFirstOrThrow({
    where: {
      slug: { startsWith: 'demo-' },
      hasMultipleVariants: true,
      inStock: true,
      brandId: { not: null },
    },
    orderBy: { slug: 'asc' },
  });
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: sample.productId },
    include: {
      variants: { include: { inventory: true }, orderBy: { createdAt: 'asc' } },
      images: true,
    },
  });
  const [first] = product.variants;
  await check('baseline');

  // 1. Price and default variant.
  await prisma.productVariant.update({ where: { id: first.id }, data: { price: 12345 } });
  await check('variant price change', async () =>
    Number((await listingOf(product.id))?.price) === 12345 ? null : 'price not updated',
  );
  await prisma.productVariant.update({ where: { id: first.id }, data: { price: first.price } });

  if (product.variants.length > 1) {
    const second = product.variants[1];
    await prisma.$transaction([
      prisma.productVariant.update({ where: { id: first.id }, data: { isDefault: false } }),
      prisma.productVariant.update({ where: { id: second.id }, data: { isDefault: true } }),
    ]);
    await check('default variant switch');
    await prisma.$transaction([
      prisma.productVariant.update({ where: { id: second.id }, data: { isDefault: false } }),
      prisma.productVariant.update({ where: { id: first.id }, data: { isDefault: true } }),
    ]);
  }

  // 2. Cover image removed and restored.
  const cover = product.images.find((i) => i.isPrimary)!;
  await prisma.productImage.delete({ where: { id: cover.id } });
  await check('cover image deleted', async () =>
    (await listingOf(product.id))?.coverImageKey !== cover.storageKey ? null : 'cover not updated',
  );
  await prisma.productImage.create({ data: cover });
  await check('cover image restored');

  // 3. Attribute reassignment (remove the material value, then put it back).
  const value = await prisma.attributeValue.findFirstOrThrow({
    where: { productId: product.id, definition: { key: 'material' } },
    include: { options: { include: { option: true } } },
  });
  await prisma.attributeValue.delete({ where: { id: value.id } });
  await check('attribute value removed', async () =>
    (await listingOf(product.id))?.optionCodes.includes(value.options[0].option.code)
      ? 'option still listed'
      : null,
  );
  await prisma.attributeValue.create({
    data: {
      id: value.id,
      definitionId: value.definitionId,
      productId: value.productId,
      value: value.value,
      options: { create: value.options.map((o) => ({ optionId: o.optionId })) },
    },
  });
  await check('attribute value restored');

  // 4. Category deactivated (whole subtree) and moved.
  const category = await prisma.category.findUniqueOrThrow({ where: { id: product.categoryId } });
  const parent = category.parentId
    ? await prisma.category.findUniqueOrThrow({ where: { id: category.parentId } })
    : null;
  if (parent) {
    await prisma.category.update({
      where: { id: parent.id },
      data: { status: CategoryStatus.INACTIVE },
    });
    await check('ancestor category deactivated', async () =>
      (await listingOf(product.id)) ? 'product still listed under an inactive ancestor' : null,
    );
    await prisma.category.update({ where: { id: parent.id }, data: { status: parent.status } });
    await check('ancestor category reactivated');

    const elsewhere = await prisma.category.findFirstOrThrow({
      where: { parentId: null, id: { not: parent.parentId ?? parent.id } },
    });
    await prisma.category.update({ where: { id: category.id }, data: { parentId: elsewhere.id } });
    await check('category moved', async () =>
      (await listingOf(product.id))?.categoryPath.includes(elsewhere.id)
        ? null
        : 'path not updated',
    );
    await prisma.category.update({
      where: { id: category.id },
      data: { parentId: category.parentId },
    });
    await check('category moved back');
  }

  // 5. Brand renamed and deactivated.
  if (product.brandId) {
    const brand = await prisma.brand.findUniqueOrThrow({ where: { id: product.brandId } });
    await prisma.brand.update({ where: { id: brand.id }, data: { name: `${brand.name} X` } });
    await check('brand renamed');
    await prisma.brand.update({ where: { id: brand.id }, data: { status: 'INACTIVE' } });
    await check('brand deactivated');
    await prisma.brand.update({
      where: { id: brand.id },
      data: { name: brand.name, status: brand.status },
    });
  }

  // 6. Stock sells out and comes back (only the crossing touches the listing).
  const stocked = product.variants.filter((v) => v.inventory);
  for (const v of stocked) {
    await prisma.inventory.update({
      where: { variantId: v.id },
      data: { reservedQuantity: v.inventory!.quantity },
    });
  }
  await check('stock sold out', async () =>
    (await listingOf(product.id))?.inStock ? 'still in stock' : null,
  );
  for (const v of stocked) {
    await prisma.inventory.update({
      where: { variantId: v.id },
      data: { quantity: v.inventory!.quantity, reservedQuantity: v.inventory!.reservedQuantity },
    });
  }
  await check('stock restored');

  // 7. Product unpublished, every variant hidden.
  await prisma.product.update({ where: { id: product.id }, data: { status: ProductStatus.DRAFT } });
  await check('product drafted', async () =>
    (await listingOf(product.id)) ? 'still listed' : null,
  );
  await prisma.product.update({
    where: { id: product.id },
    data: { status: ProductStatus.ACTIVE },
  });
  await prisma.productVariant.updateMany({
    where: { productId: product.id },
    data: { status: VariantStatus.HIDDEN },
  });
  await check('all variants hidden', async () =>
    (await listingOf(product.id)) ? 'still listed' : null,
  );
  for (const v of product.variants) {
    await prisma.productVariant.update({ where: { id: v.id }, data: { status: v.status } });
  }
  await check('variants restored');

  // 8. Concurrency: a price change and a sell-out on the same product, interleaved.
  const a = connect();
  const b = connect();
  try {
    const newPrice = 23456;
    const writerA = a.$transaction(
      async (tx) => {
        await tx.productVariant.update({ where: { id: first.id }, data: { price: newPrice } });
        await sleep(1500); // hold the product lock while B tries to refresh it
      },
      { timeout: 20_000 },
    );
    await sleep(300);
    const writerB = b.$transaction(
      async (tx) => {
        for (const v of stocked) {
          await tx.inventory.update({
            where: { variantId: v.id },
            data: { reservedQuantity: v.inventory!.quantity },
          });
        }
      },
      { timeout: 20_000 },
    );
    await Promise.all([writerA, writerB]);
    await check('concurrent price change + sell-out (no lost update)', async () => {
      const row = await listingOf(product.id);
      if (Number(row?.price) !== newPrice) return `price lost: ${String(row?.price)}`;
      if (row?.inStock) return 'stock change lost';
      return null;
    });
  } finally {
    await prisma.productVariant.update({ where: { id: first.id }, data: { price: first.price } });
    for (const v of stocked) {
      await prisma.inventory.update({
        where: { variantId: v.id },
        data: { quantity: v.inventory!.quantity, reservedQuantity: v.inventory!.reservedQuantity },
      });
    }
    await Promise.all([a.$disconnect(), b.$disconnect()]);
  }
  await check('restored after concurrency test');

  if (failures) {
    console.error(`\n✗ ${failures} scenario(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\n✓ All listing scenarios passed');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
