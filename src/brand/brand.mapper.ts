import { Brand } from '@prisma/client';
import { BrandResponseDto } from './dto/brand-response.dto';

export class BrandMapper {
  static toResponse(brand: Brand): BrandResponseDto {
    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      logoUrl: brand.logoUrl,
      status: brand.status,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    };
  }
}
