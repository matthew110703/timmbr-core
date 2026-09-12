import { Product } from '@prisma/client';
import { ProductResponseDto } from './dto/product-response.dto';

export class ProductMapper {
  static toResponse(product: Product): ProductResponseDto {
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
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
