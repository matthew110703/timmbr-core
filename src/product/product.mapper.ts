import { AttributeDefinition, AttributeValue, Product, ProductImage } from '@prisma/client';
import { ProductCoverImageDto, ProductResponseDto } from './dto/product-response.dto';
import { AttributeMapper } from './attribute/mappers/attribute.mapper';
import { VariantMapper, ProductVariantWithInventory } from './variant/variant.mapper';
import { MediaService } from '@/media/media.service';

export type ProductWithDetails = Product & {
  images?: ProductImage[];
  attributeValues?: (AttributeValue & { definition: AttributeDefinition })[];
  variants?: (ProductVariantWithInventory & {
    attributeValues?: (AttributeValue & { definition: AttributeDefinition })[];
  })[];
};

export class ProductMapper {
  static toResponse(
    product: ProductWithDetails,
    mediaService?: MediaService,
    options?: { includeVariants?: boolean },
  ): ProductResponseDto {
    const includeVariants = options?.includeVariants ?? true;

    const hasAttributes = includeVariants && Array.isArray(product.attributeValues);
    const hasVariants = includeVariants && Array.isArray(product.variants);

    const attributes = hasAttributes
      ? product.attributeValues!.map((av) => AttributeMapper.toProductSpecification(av))
      : undefined;

    const variantOptions = hasVariants
      ? AttributeMapper.toVariantOptionGroups(product.variants!)
      : undefined;

    const variants = hasVariants
      ? product.variants!.map((v) => VariantMapper.toResponse(v))
      : undefined;

    const primaryImage = product.images?.[0];
    const coverImage: ProductCoverImageDto | null | undefined =
      product.images !== undefined
        ? primaryImage
          ? {
              id: primaryImage.id,
              url: mediaService
                ? mediaService.getPublicUrl(primaryImage.storageKey)
                : primaryImage.storageKey,
              altText: primaryImage.altText ?? null,
            }
          : null
        : undefined;

    const activeVariants = product.variants;
    const defaultVariant = activeVariants?.find((v) => v.isDefault) ?? activeVariants?.[0];

    const price = defaultVariant ? Number(defaultVariant.price) : null;
    const compareAtPrice =
      defaultVariant?.compareAtPrice !== null && defaultVariant?.compareAtPrice !== undefined
        ? Number(defaultVariant.compareAtPrice)
        : null;
    const currency = defaultVariant ? defaultVariant.currency : null;
    const hasMultipleVariants = activeVariants ? activeVariants.length > 1 : false;

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description ?? null,
      shortDescription: product.shortDescription,
      status: product.status,
      hsnCode: product.hsnCode ?? null,
      gstRate: Number(product.gstRate),
      brandId: product.brandId ?? null,
      categoryId: product.categoryId,
      price,
      compareAtPrice,
      currency,
      hasMultipleVariants,
      ...(coverImage !== undefined && { coverImage }),
      ...(attributes && { attributes }),
      ...(variantOptions && { variantOptions }),
      ...(variants && { variants }),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
