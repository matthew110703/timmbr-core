import { AttributeDefinition, AttributeValue, Product } from '@prisma/client';
import { ProductResponseDto } from './dto/product-response.dto';
import { AttributeMapper } from './attribute/mappers/attribute.mapper';
import { VariantMapper, ProductVariantWithInventory } from './variant/variant.mapper';

export type ProductWithDetails = Product & {
  attributeValues?: (AttributeValue & { definition: AttributeDefinition })[];
  variants?: (ProductVariantWithInventory & {
    attributeValues?: (AttributeValue & { definition: AttributeDefinition })[];
  })[];
};

export class ProductMapper {
  static toResponse(product: ProductWithDetails): ProductResponseDto {
    const hasAttributes = Array.isArray(product.attributeValues);
    const hasVariants = Array.isArray(product.variants);

    const attributes = hasAttributes
      ? product.attributeValues!.map((av) => AttributeMapper.toProductSpecification(av))
      : undefined;

    const variantOptions = hasVariants
      ? AttributeMapper.toVariantOptionGroups(product.variants!)
      : undefined;

    const variants = hasVariants
      ? product.variants!.map((v) => VariantMapper.toResponse(v))
      : undefined;

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
      ...(attributes && { attributes }),
      ...(variantOptions && { variantOptions }),
      ...(variants && { variants }),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
