import { ProductStatus, VariantStatus, Wishlist } from '@prisma/client';
import { VariantMapper } from '@/product/variant/variant.mapper';
import { WishlistItemResponseDto } from './dto/wishlist-item-response.dto';
import { WishlistResponseDto } from './dto/wishlist-response.dto';
import { WishlistItemWithRelations } from './wishlist.repository';

export class WishlistMapper {
  static toResponse(wishlist: Wishlist, items: WishlistItemResponseDto[]): WishlistResponseDto {
    return {
      id: wishlist.id,
      items,
      itemCount: items.length,
      createdAt: wishlist.createdAt,
      updatedAt: wishlist.updatedAt,
    };
  }

  static toItemResponse(
    item: WishlistItemWithRelations,
    thumbnail: string | null,
  ): WishlistItemResponseDto {
    // Price and availability always come from the current variant record — never snapshotted
    const variant = VariantMapper.toResponse(item.variant);

    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      product: {
        id: item.product.id,
        title: item.product.title,
        slug: item.product.slug,
        status: item.product.status,
      },
      variant,
      thumbnail,
      isAvailable:
        item.product.status === ProductStatus.ACTIVE &&
        item.variant.status === VariantStatus.ACTIVE &&
        variant.availability.status === 'IN_STOCK',
      addedAt: item.createdAt,
    };
  }
}
