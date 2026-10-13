/**
 * Recomputes every ProductListing row (the triggers keep it current; this is the repair tool,
 * e.g. after restoring data with triggers disabled).
 *
 * Run: pnpm listing:rebuild
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../src/config/env';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

async function main() {
  const started = Date.now();
  await prisma.$executeRaw`SELECT refresh_product_listing(NULL)`;
  const rows = await prisma.productListing.count();
  console.log(`✓ ProductListing rebuilt: ${rows} rows in ${Date.now() - started}ms`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
