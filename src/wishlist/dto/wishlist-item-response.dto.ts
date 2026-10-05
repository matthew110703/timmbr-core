import { ProductStatus } from '@prisma/client';
import { VariantResponseDto } from '@/product/variant/dto/variant-response.dto';

export class WishlistItemProductDto {
  id!: string;
  title!: string;
  slug!: string;
  status!: ProductStatus;
}

export class WishlistItemResponseDto {
  id!: string;
  productId!: string;
  variantId!: string;
  product!: WishlistItemProductDto;
  variant!: VariantResponseDto;
  thumbnail!: string | null;
  isAvailable!: boolean;
  addedAt!: Date;
}
