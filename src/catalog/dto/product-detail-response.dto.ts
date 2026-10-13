export type ProductStockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export class ProductDetailImageDto {
  url!: string;
  alt!: string;
  /** Set when the image shows one variant (e.g. a finish); null for the whole product. */
  variantId!: string | null;
}

export class ProductOptionDto {
  /** URL value (`?finish=walnut`). */
  value!: string;
  label!: string;
  swatchHex!: string | null;
}

export class ProductOptionGroupDto {
  /** URL key (`finish`). */
  key!: string;
  name!: string;
  display!: 'SWATCH' | 'PILL';
  options!: ProductOptionDto[];
}

export class ProductDetailVariantDto {
  id!: string;
  sku!: string;
  price!: number;
  compareAtPrice!: number | null;
  discountPct!: number;
  currency!: string;
  isDefault!: boolean;
  /** The variant's value in each option group: `{ finish: 'walnut' }`. */
  options!: Record<string, string>;
  stock!: ProductStockStatus;
  /** Units that can be added to a cart now (free stock, capped at the per-item limit). */
  available!: number;
}

export class ProductSpecDto {
  label!: string;
  value!: string;
}

export class ProductDetailResponseDto {
  id!: string;
  slug!: string;
  title!: string;
  shortDescription!: string;
  description!: string | null;
  brand!: { name: string; slug: string } | null;
  /** Root → the product's category. */
  breadcrumb!: { name: string; slug: string }[];
  categorySlug!: string;
  images!: ProductDetailImageDto[];
  optionGroups!: ProductOptionGroupDto[];
  variants!: ProductDetailVariantDto[];
  defaultVariantId!: string;
  specs!: ProductSpecDto[];
  flags!: { fastDelivery: boolean; clearance: boolean };
}
