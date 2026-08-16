import { ProductVariant } from '@prisma/client';
import { VariantResponseDto } from './dto/variant-response.dto';

export class VariantMapper {
  static toResponse(variant: ProductVariant): VariantResponseDto {
    return {
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      price: variant.price,
      isDefault: variant.isDefault,
      status: variant.status,
      currency: variant.currency,
      compareAtPrice: variant.compareAtPrice ?? null,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };
  }
}
