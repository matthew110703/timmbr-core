import { Injectable } from '@nestjs/common';
import { Prisma, ProductStatus, VariantStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

const OPTIONS = {
  select: {
    option: { select: { slug: true, label: true, swatchHex: true, sortOrder: true } },
  },
} as const;

const DEFINITION = {
  select: {
    id: true,
    key: true,
    name: true,
    type: true,
    unit: true,
    scope: true,
    displayType: true,
    filterOrder: true,
  },
} as const;

/** Everything the product page needs, in one query. */
export const PRODUCT_DETAIL_INCLUDE = {
  brand: { select: { name: true, slug: true, status: true } },
  category: { select: { slug: true } },
  images: {
    select: { storageKey: true, altText: true, variantId: true },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
  attributeValues: {
    where: { productId: { not: null } },
    select: { value: true, definition: DEFINITION, options: OPTIONS },
    orderBy: { createdAt: 'asc' },
  },
  variants: {
    where: { status: VariantStatus.ACTIVE },
    // Default variant first, then oldest: the same rule as the listing price.
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      sku: true,
      price: true,
      compareAtPrice: true,
      currency: true,
      isDefault: true,
      inventory: { select: { quantity: true, reservedQuantity: true } },
      attributeValues: {
        select: { value: true, definition: DEFINITION, options: OPTIONS },
        orderBy: { createdAt: 'asc' },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export type ProductDetailRow = Prisma.ProductGetPayload<{
  include: typeof PRODUCT_DETAIL_INCLUDE;
}>;
export type ProductDetailAttributeRow = ProductDetailRow['attributeValues'][number];

@Injectable()
export class ProductDetailRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The ACTIVE product with this slug and its ACTIVE variants, or null. */
  findActiveBySlug(slug: string): Promise<ProductDetailRow | null> {
    return this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE },
      include: PRODUCT_DETAIL_INCLUDE,
    });
  }
}
