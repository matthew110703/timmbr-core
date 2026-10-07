import {
  PrismaClient,
  ProductStatus,
  VariantStatus,
  CategoryStatus,
  BrandStatus,
  AttributeType,
  AttributeScope,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
// Loads .env and validates it (DATABASE_URL is required by the schema).
import { env } from '../src/config/env';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

const bucket = env.STORAGE_BUCKET;
const endpoint = env.STORAGE_ENDPOINT;
const accessKeyId = env.STORAGE_ACCESS_KEY_ID;
const secretAccessKey = env.STORAGE_SECRET_ACCESS_KEY;

let s3: S3Client | null = null;
if (endpoint && accessKeyId && secretAccessKey && bucket) {
  s3 = new S3Client({
    endpoint,
    region: env.STORAGE_REGION, // schema default: 'auto'
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function uploadImageToR2(storageKey: string, sourceUrl: string) {
  if (!s3 || !bucket) {
    console.log(
      `  ⚠️ Skipping R2 upload for ${storageKey} (S3/R2 storage credentials not configured)`,
    );
    return;
  }
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: 'image/jpeg',
      }),
    );
    console.log(`  ☁️ Uploaded R2 Object: ${storageKey} (${Math.round(buffer.length / 1024)} KB)`);
  } catch (error) {
    console.error(`  ❌ Failed to upload R2 object ${storageKey}:`, error);
  }
}

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Brands
  const brandsData = [
    {
      name: 'Timmbr Originals',
      slug: 'timmbr-originals',
      description:
        'Handcrafted solid wood furniture celebrating Scandinavian and Japandi minimalism.',
      status: BrandStatus.ACTIVE,
    },
    {
      name: 'Timmbr Studio',
      slug: 'timmbr-studio',
      description: 'Contemporary architectural pieces designed for modern urban living.',
      status: BrandStatus.ACTIVE,
    },
    {
      name: 'Timmbr Craft',
      slug: 'timmbr-craft',
      description:
        'Master woodworkers crafting heirloom dining and cabinetry with traditional joinery.',
      status: BrandStatus.ACTIVE,
    },
  ];

  const brandMap = new Map<string, string>();
  for (const b of brandsData) {
    const brand = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: { name: b.name, description: b.description, status: b.status },
      create: b,
    });
    brandMap.set(b.slug, brand.id);
  }
  console.log(`✓ Seeded ${brandMap.size} brands`);

  // 2. Seed Categories
  const categoriesData = [
    {
      name: 'Living Room',
      slug: 'living-room',
      description: 'Sofas, armchairs, coffee tables, and living room storage.',
      status: CategoryStatus.ACTIVE,
    },
    {
      name: 'Dining Room',
      slug: 'dining-room',
      description: 'Solid wood dining tables, dining chairs, and barstools.',
      status: CategoryStatus.ACTIVE,
    },
    {
      name: 'Bedroom',
      slug: 'bedroom',
      description: 'Solid wood platform beds, nightstands, and dressers.',
      status: CategoryStatus.ACTIVE,
    },
    {
      name: 'Storage & Cabinetry',
      slug: 'storage-cabinetry',
      description: 'Sideboards, credenzas, shelving, and entertainment units.',
      status: CategoryStatus.ACTIVE,
    },
  ];

  const categoryMap = new Map<string, string>();
  for (const c of categoriesData) {
    let cat = await prisma.category.findFirst({
      where: { slug: c.slug, parentId: null },
    });
    if (!cat) {
      cat = await prisma.category.create({ data: c });
    } else {
      cat = await prisma.category.update({
        where: { id: cat.id },
        data: { name: c.name, description: c.description, status: c.status },
      });
    }
    categoryMap.set(c.slug, cat.id);
  }
  console.log(`✓ Seeded ${categoryMap.size} categories`);

  // 3. Define the 5 Products with Variants, Images, and Attributes
  const productsToSeed = [
    // Product 1: Nordic Minimalist Oak Dining Table
    {
      title: 'Nordic Minimalist Oak Dining Table',
      slug: 'nordic-minimalist-oak-dining-table',
      shortDescription:
        'Solid European white oak dining table with beveled edges and soft-rounded silhouette.',
      description:
        'Crafted from sustainable European White Oak, this centerpiece dining table seamlessly blends Scandinavian purity with timeless ergonomics. Featuring softly rounded edge profiles and subtly tapered cylindrical legs, each piece displays unique natural wood grain patterns sealed in an ultra-matte, stain-resistant protective clear lacquer.',
      hsnCode: '9403.60.00',
      gstRate: 18,
      brandSlug: 'timmbr-craft',
      categorySlug: 'dining-room',
      status: ProductStatus.ACTIVE,
      attributes: [
        {
          name: 'Material',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: 'Solid European White Oak',
        },
        {
          name: 'Finish',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: 'Ultra-Matte UV Protective Lacquer',
        },
        {
          name: 'Assembly',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: 'Minimal assembly required (legs attach in 10 mins)',
        },
        {
          name: 'Seating Capacity',
          type: AttributeType.STRING,
          scope: AttributeScope.VARIANT,
          value: '6–8 Persons',
        },
      ],
      images: [
        {
          storageKey: 'products/nordic-minimalist-oak-dining-table/images/hero.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?auto=format&fit=crop&w=1200&q=80',
          altText: 'Nordic Minimalist Oak Dining Table in sunlit Scandinavian dining room',
          isPrimary: true,
          sortOrder: 0,
        },
        {
          storageKey: 'products/nordic-minimalist-oak-dining-table/images/detail-grain.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1577140917170-285929fb55b7?auto=format&fit=crop&w=1200&q=80',
          altText: 'Solid oak dining table top close up detailing natural wood grain',
          isPrimary: false,
          sortOrder: 1,
        },
        {
          storageKey: 'products/nordic-minimalist-oak-dining-table/images/styled.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=1200&q=80',
          altText: 'Dining table styled with ceramic tableware and linen',
          isPrimary: false,
          sortOrder: 2,
        },
      ],
      variants: [
        {
          sku: 'TBL-NOAK-6S-NAT',
          price: 54999,
          compareAtPrice: 62000,
          isDefault: true,
          stock: 20,
          status: VariantStatus.ACTIVE,
          variantAttributes: [
            { name: 'Size', value: '180cm x 90cm x 76cm' },
            { name: 'Color / Finish', value: 'Natural White Oak' },
          ],
        },
        {
          sku: 'TBL-NOAK-8S-SMK',
          price: 68999,
          compareAtPrice: 78000,
          isDefault: false,
          stock: 14,
          status: VariantStatus.ACTIVE,
          variantAttributes: [
            { name: 'Size', value: '220cm x 95cm x 76cm' },
            { name: 'Color / Finish', value: 'Smoked Charcoal Oak' },
          ],
        },
      ],
    },

    // Product 2: Koto Bouclé Curved Accent Chair
    {
      title: 'Koto Bouclé Curved Accent Chair',
      slug: 'koto-boucle-curved-accent-chair',
      shortDescription:
        'Sculptural lounge chair upholstered in tactile textured bouclé fabric with a barrel back silhouette.',
      description:
        'The Koto Accent Chair is an architectural triumph designed to cocoon and inspire. Constructed around an FSC-certified solid beechwood frame, it is wrapped in high-density resilient foam and upholstered in premium heavy-gauge Italian bouclé fabric with deep tactile texture. The barrel curve offers lumbar support without sacrificing visual lightness.',
      hsnCode: '9401.61.00',
      gstRate: 18,
      brandSlug: 'timmbr-studio',
      categorySlug: 'living-room',
      status: ProductStatus.ACTIVE,
      attributes: [
        {
          name: 'Frame Construction',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: 'FSC-Certified Solid Beechwood',
        },
        {
          name: 'Fabric Type',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: 'Heavyweight Italian Bouclé',
        },
        {
          name: 'Weight Capacity',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: '150 kg',
        },
      ],
      images: [
        {
          storageKey: 'products/koto-boucle-curved-accent-chair/images/oatmeal-hero.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=80',
          altText: 'Koto Bouclé Curved Accent Chair in warm cream bouclé fabric',
          isPrimary: true,
          sortOrder: 0,
        },
        {
          storageKey: 'products/koto-boucle-curved-accent-chair/images/back-curve.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1200&q=80',
          altText: 'Side angle of curved sculptural backrest and ergonomic cushion',
          isPrimary: false,
          sortOrder: 1,
        },
        {
          storageKey: 'products/koto-boucle-curved-accent-chair/images/charcoal-variant.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&w=1200&q=80',
          altText: 'Charcoal grey lounge chair in modern minimalist corner',
          isPrimary: false,
          sortOrder: 2,
        },
      ],
      variants: [
        {
          sku: 'CHR-KOTO-BOU-OAT',
          price: 24999,
          compareAtPrice: 29000,
          isDefault: true,
          stock: 35,
          status: VariantStatus.ACTIVE,
          variantAttributes: [
            { name: 'Color / Finish', value: 'Oatmeal Cream' },
            { name: 'Upholstery', value: 'Textured Bouclé' },
          ],
        },
        {
          sku: 'CHR-KOTO-BOU-CHR',
          price: 24999,
          compareAtPrice: 29000,
          isDefault: false,
          stock: 22,
          status: VariantStatus.ACTIVE,
          variantAttributes: [
            { name: 'Color / Finish', value: 'Charcoal Grey' },
            { name: 'Upholstery', value: 'Textured Bouclé' },
          ],
        },
        {
          sku: 'CHR-KOTO-VLV-OLV',
          price: 26999,
          compareAtPrice: 31500,
          isDefault: false,
          stock: 18,
          status: VariantStatus.ACTIVE,
          variantAttributes: [
            { name: 'Color / Finish', value: 'Olive Forest' },
            { name: 'Upholstery', value: 'Brushed Velvet' },
          ],
        },
      ],
    },

    // Product 3: Søren Mid-Century 3-Seater Sofa
    {
      title: 'Søren Mid-Century 3-Seater Sofa',
      slug: 'soren-mid-century-3-seater-sofa',
      shortDescription:
        'Classic mid-century sofa with tapered solid walnut legs, high-resilience cushioning, and tailored tufting.',
      description:
        'A masterclass in mid-century proportions, the Søren Sofa blends architectural lines with plush everyday comfort. Fitted with layered pocket springs and high-resilience memory foam encased in duck-feather wrapping, it maintains its tailored profile over years of lounging. Solid American walnut legs provide elevated ground clearance and rich organic warmth.',
      hsnCode: '9401.61.00',
      gstRate: 18,
      brandSlug: 'timmbr-studio',
      categorySlug: 'living-room',
      status: ProductStatus.ACTIVE,
      attributes: [
        {
          name: 'Frame Material',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: 'Kiln-Dried Birch Hardwood',
        },
        {
          name: 'Leg Material',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: 'Solid American Walnut',
        },
        {
          name: 'Cushion Filling',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: 'Pocket Spring Core with Feather & Foam Wrap',
        },
        {
          name: 'Dimensions',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: '215cm W x 92cm D x 84cm H',
        },
      ],
      images: [
        {
          storageKey: 'products/soren-mid-century-3-seater-sofa/images/cognac-leather-hero.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80',
          altText: 'Søren Mid-Century 3-Seater Sofa in warm living room with house plants',
          isPrimary: true,
          sortOrder: 0,
        },
        {
          storageKey: 'products/soren-mid-century-3-seater-sofa/images/sunlit-living-room.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1200&q=80',
          altText: 'Warm afternoon light over Søren Sofa cushions and solid walnut legs',
          isPrimary: false,
          sortOrder: 1,
        },
        {
          storageKey: 'products/soren-mid-century-3-seater-sofa/images/mineral-grey-linen.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1200&q=80',
          altText: 'Mineral grey tailored fabric finish styled in modern interior',
          isPrimary: false,
          sortOrder: 2,
        },
        {
          storageKey: 'products/soren-mid-century-3-seater-sofa/images/forest-emerald-velvet.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1540574163026-643ea20ade25?auto=format&fit=crop&w=1200&q=80',
          altText: 'Deep forest green luxury upholstery variant',
          isPrimary: false,
          sortOrder: 3,
        },
      ],
      variants: [
        {
          sku: 'SOF-SOREN-LTH-CGN',
          price: 89999,
          compareAtPrice: 105000,
          isDefault: true,
          stock: 12,
          status: VariantStatus.ACTIVE,
          variantAttributes: [
            { name: 'Upholstery Material', value: 'Full-Grain Caramel Leather' },
            { name: 'Color', value: 'Cognac Saddle' },
          ],
        },
        {
          sku: 'SOF-SOREN-WVE-GRY',
          price: 64999,
          compareAtPrice: 75000,
          isDefault: false,
          stock: 19,
          status: VariantStatus.ACTIVE,
          variantAttributes: [
            { name: 'Upholstery Material', value: 'Belgian Linen Weave' },
            { name: 'Color', value: 'Mineral Mist Grey' },
          ],
        },
        {
          sku: 'SOF-SOREN-BC-GRN',
          price: 69999,
          compareAtPrice: 82000,
          isDefault: false,
          stock: 8,
          status: VariantStatus.ACTIVE,
          variantAttributes: [
            { name: 'Upholstery Material', value: 'Textured Wool Bouclé' },
            { name: 'Color', value: 'Forest Emerald' },
          ],
        },
      ],
    },

    // Product 4: Kyoto Floating Walnut Platform Bed
    {
      title: 'Kyoto Floating Walnut Platform Bed',
      slug: 'kyoto-floating-walnut-platform-bed',
      shortDescription:
        'Japanese-inspired low-profile solid American walnut bed frame with cantilevered floating effect.',
      description:
        'Inspired by traditional Japanese joinery and modern spatial minimalism, the Kyoto Platform Bed elevates your sanctuary. Recessed interior plinth supports create an ethereal floating silhouette while the oversized solid walnut headboard highlights continuous natural grain and bookmatched timber craft. Integrated slat roll provides ergonomic support for any mattress type without requiring a box spring.',
      hsnCode: '9403.50.00',
      gstRate: 18,
      brandSlug: 'timmbr-originals',
      categorySlug: 'bedroom',
      status: ProductStatus.ACTIVE,
      attributes: [
        {
          name: 'Wood Species',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: 'Solid American Black Walnut',
        },
        {
          name: 'Foundation',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: 'Heavy-Duty Solid Pine Slat Roll (included)',
        },
        {
          name: 'Headboard Style',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: 'Bookmatched Continuous Grain Panel',
        },
      ],
      images: [
        {
          storageKey: 'products/kyoto-floating-walnut-platform-bed/images/queen-walnut-hero.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
          altText: 'Kyoto Floating Walnut Platform Bed styled with white linen in minimal bedroom',
          isPrimary: true,
          sortOrder: 0,
        },
        {
          storageKey: 'products/kyoto-floating-walnut-platform-bed/images/headboard-nightstand.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80',
          altText: 'Detail of floating walnut cantilever nightstand and bookmatched headboard',
          isPrimary: false,
          sortOrder: 1,
        },
        {
          storageKey: 'products/kyoto-floating-walnut-platform-bed/images/bedroom-view.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
          altText: 'Architectural angle showing low-profile floating base',
          isPrimary: false,
          sortOrder: 2,
        },
      ],
      variants: [
        {
          sku: 'BED-KYOTO-WAL-QN',
          price: 74999,
          compareAtPrice: 88000,
          isDefault: true,
          stock: 15,
          status: VariantStatus.ACTIVE,
          variantAttributes: [
            { name: 'Mattress Size', value: 'Queen (160 x 200 cm)' },
            { name: 'Wood Finish', value: 'Natural Walnut Matte' },
          ],
        },
        {
          sku: 'BED-KYOTO-WAL-KG',
          price: 84999,
          compareAtPrice: 99000,
          isDefault: false,
          stock: 10,
          status: VariantStatus.ACTIVE,
          variantAttributes: [
            { name: 'Mattress Size', value: 'King (180 x 200 cm)' },
            { name: 'Wood Finish', value: 'Natural Walnut Matte' },
          ],
        },
      ],
    },

    // Product 5: Aura Fluted Solid Ash Sideboard / Credenza
    {
      title: 'Aura Fluted Solid Ash Sideboard',
      slug: 'aura-fluted-solid-ash-sideboard',
      shortDescription:
        'Tambour fluted solid ash credenza with soft-close sliding doors and warm brass details.',
      description:
        'The Aura Credenza is a statement in texture and craftsmanship. Featuring individual vertical solid ash tambour battens that glide effortlessly on hidden precision tracks, it conceals extensive interior storage, adjustable shelving, and integrated cord-management ports. Finished with brushed antique brass feet and understated hardware.',
      hsnCode: '9403.60.00',
      gstRate: 18,
      brandSlug: 'timmbr-craft',
      categorySlug: 'storage-cabinetry',
      status: ProductStatus.ACTIVE,
      attributes: [
        {
          name: 'Body & Doors',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: 'Solid White Ash & Ash Veneer Core',
        },
        {
          name: 'Hardware',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: 'Solid Brushed Antique Brass',
        },
        {
          name: 'Cable Management',
          type: AttributeType.STRING,
          scope: AttributeScope.PRODUCT,
          value: '2x Recessed Rear Grommets',
        },
      ],
      images: [
        {
          storageKey: 'products/aura-fluted-solid-ash-sideboard/images/blonde-ash-hero.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=1200&q=80',
          altText:
            'Aura Fluted Solid Ash Sideboard against warm neutral wall with minimal ceramics',
          isPrimary: true,
          sortOrder: 0,
        },
        {
          storageKey: 'products/aura-fluted-solid-ash-sideboard/images/fluted-wood-detail.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=1200&q=80',
          altText: 'Close up of tambour fluted vertical wooden ridges and joinery',
          isPrimary: false,
          sortOrder: 1,
        },
        {
          storageKey: 'products/aura-fluted-solid-ash-sideboard/images/dark-espresso-variant.jpg',
          sourceUrl:
            'https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=1200&q=80',
          altText: 'Espresso dark ash finish variant in dining room setting',
          isPrimary: false,
          sortOrder: 2,
        },
      ],
      variants: [
        {
          sku: 'CRD-AURA-ASH-160-NAT',
          price: 49999,
          compareAtPrice: 58000,
          isDefault: true,
          stock: 25,
          status: VariantStatus.ACTIVE,
          variantAttributes: [
            { name: 'Length', value: '160cm (3 Doors)' },
            { name: 'Color / Finish', value: 'Blonde Scandinavian Ash' },
          ],
        },
        {
          sku: 'CRD-AURA-ASH-200-ESP',
          price: 62999,
          compareAtPrice: 72000,
          isDefault: false,
          stock: 16,
          status: VariantStatus.ACTIVE,
          variantAttributes: [
            { name: 'Length', value: '200cm (4 Doors)' },
            { name: 'Color / Finish', value: 'Dark Espresso Ash' },
          ],
        },
      ],
    },
  ];

  for (const item of productsToSeed) {
    const brandId = brandMap.get(item.brandSlug);
    const categoryId = categoryMap.get(item.categorySlug);

    if (!categoryId) {
      throw new Error(`Category not found: ${item.categorySlug}`);
    }

    // 3.1 Upsert Product
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        title: item.title,
        shortDescription: item.shortDescription,
        description: item.description,
        hsnCode: item.hsnCode,
        gstRate: item.gstRate,
        brandId: brandId ?? null,
        categoryId: categoryId,
        status: item.status,
      },
      create: {
        title: item.title,
        slug: item.slug,
        shortDescription: item.shortDescription,
        description: item.description,
        hsnCode: item.hsnCode,
        gstRate: item.gstRate,
        brandId: brandId ?? null,
        categoryId: categoryId,
        status: item.status,
      },
    });

    console.log(`\n📦 Product: ${product.title} (${product.slug})`);

    // 3.2 Product Attributes
    for (const attr of item.attributes) {
      let def = await prisma.attributeDefinition.findFirst({
        where: { name: attr.name, productId: product.id },
      });
      if (!def) {
        def = await prisma.attributeDefinition.create({
          data: {
            name: attr.name,
            type: attr.type,
            scope: attr.scope,
            productId: product.id,
            isFilterable: true,
          },
        });
      }

      const existingVal = await prisma.attributeValue.findFirst({
        where: { definitionId: def.id, productId: product.id },
      });
      if (!existingVal) {
        await prisma.attributeValue.create({
          data: {
            definitionId: def.id,
            productId: product.id,
            value: attr.value,
          },
        });
      }
    }

    // 3.3 Images - Upload to R2 and Sync Database Records
    await prisma.productImage.deleteMany({
      where: { productId: product.id },
    });

    for (const img of item.images) {
      await uploadImageToR2(img.storageKey, img.sourceUrl);

      await prisma.productImage.create({
        data: {
          productId: product.id,
          storageKey: img.storageKey,
          altText: img.altText,
          isPrimary: img.isPrimary,
          sortOrder: img.sortOrder,
        },
      });
    }
    console.log(`  ✓ Synced & Uploaded ${item.images.length} images to R2`);

    // 3.4 Variants & Inventory
    for (const v of item.variants) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          isDefault: v.isDefault,
          status: v.status,
        },
        create: {
          productId: product.id,
          sku: v.sku,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          isDefault: v.isDefault,
          status: v.status,
        },
      });

      // Inventory
      await prisma.inventory.upsert({
        where: { variantId: variant.id },
        update: {
          quantity: v.stock,
          reservedQuantity: 0,
        },
        create: {
          variantId: variant.id,
          quantity: v.stock,
          reservedQuantity: 0,
        },
      });

      // Variant Attributes
      for (const va of v.variantAttributes) {
        let def = await prisma.attributeDefinition.findFirst({
          where: { name: va.name, productId: product.id },
        });
        if (!def) {
          def = await prisma.attributeDefinition.create({
            data: {
              name: va.name,
              type: AttributeType.STRING,
              scope: AttributeScope.VARIANT,
              productId: product.id,
              isFilterable: true,
            },
          });
        }

        const existingVal = await prisma.attributeValue.findFirst({
          where: { definitionId: def.id, variantId: variant.id },
        });
        if (!existingVal) {
          await prisma.attributeValue.create({
            data: {
              definitionId: def.id,
              variantId: variant.id,
              value: va.value,
            },
          });
        } else {
          await prisma.attributeValue.update({
            where: { id: existingVal.id },
            data: { value: va.value },
          });
        }
      }

      console.log(`  ✓ Variant: ${v.sku} (₹${v.price}, Stock: ${v.stock})`);
    }
  }

  console.log('\n🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
