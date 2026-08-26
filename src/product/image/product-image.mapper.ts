import { ProductImage } from '@prisma/client';
import { ProductImageResponseDto } from './dto/product-image-response.dto';

export class ProductImageMapper {
  static toResponse(image: ProductImage, url: string): ProductImageResponseDto {
    return {
      id: image.id,
      productId: image.productId,
      variantId: image.variantId,
      storageKey: image.storageKey,
      url,
      altText: image.altText,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
    };
  }
}
