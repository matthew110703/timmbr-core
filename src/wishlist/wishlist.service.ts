import { Injectable } from '@nestjs/common';
import { ProductStatus, VariantStatus } from '@prisma/client';
import { MediaService } from '@/media/media.service';
import { VariantNotFoundException } from '@/common/exceptions/variant.exception';
import { WishlistItemNotFoundException } from '@/common/exceptions/wishlist.exception';
import { WishlistMapper } from './wishlist.mapper';
import {
  VariantWithProduct,
  WishlistItemWithRelations,
  WishlistRepository,
} from './wishlist.repository';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';
import { WishlistResponseDto } from './dto/wishlist-response.dto';
import { WishlistItemResponseDto } from './dto/wishlist-item-response.dto';
import { WishlistCheckResponseDto } from './dto/wishlist-check-response.dto';

@Injectable()
export class WishlistService {
  constructor(
    private readonly wishlistRepository: WishlistRepository,
    private readonly mediaService: MediaService,
  ) {}

  async getWishlist(userId: string): Promise<WishlistResponseDto> {
    const existing = await this.wishlistRepository.findWithItemsByUserId(userId);
    if (existing) {
      const items = existing.items.map((item) => this.toItemResponse(item));
      return WishlistMapper.toResponse(existing, items);
    }

    // Lazy creation on first access
    const wishlist = await this.wishlistRepository.findOrCreateByUserId(userId);
    return WishlistMapper.toResponse(wishlist, []);
  }

  async addItem(userId: string, dto: AddWishlistItemDto): Promise<WishlistItemResponseDto> {
    const variant = await this.findVariant(dto.variantId);
    if (
      variant.status !== VariantStatus.ACTIVE ||
      variant.product.status !== ProductStatus.ACTIVE
    ) {
      throw new VariantNotFoundException();
    }

    const wishlist = await this.wishlistRepository.findOrCreateByUserId(userId);
    // productId is always derived from the variant relationship, never from the client
    const item = await this.wishlistRepository.addItem(wishlist.id, variant.productId, variant.id);
    return this.toItemResponse(item);
  }

  async removeItem(userId: string, variantId: string): Promise<{ variantId: string }> {
    const removed = await this.wishlistRepository.removeItemForUser(userId, variantId);
    if (removed > 0) return { variantId };

    // Nothing removed: distinguish an unknown variant from one that isn't in this user's wishlist
    const exists = await this.wishlistRepository.variantExists(variantId);
    if (!exists) throw new VariantNotFoundException();
    throw new WishlistItemNotFoundException();
  }

  async check(userId: string, variantId: string): Promise<WishlistCheckResponseDto> {
    const [exists, inWishlist] = await Promise.all([
      this.wishlistRepository.variantExists(variantId),
      this.wishlistRepository.hasItemForUser(userId, variantId),
    ]);
    if (!exists) throw new VariantNotFoundException();
    return { inWishlist };
  }

  private async findVariant(variantId: string): Promise<VariantWithProduct> {
    const variant = await this.wishlistRepository.findVariantWithProduct(variantId);
    if (!variant) throw new VariantNotFoundException();
    return variant;
  }

  private toItemResponse(item: WishlistItemWithRelations): WishlistItemResponseDto {
    // Thumbnail resolution (variant primary image > product primary image)
    const storageKey = item.variant.images[0]?.storageKey || item.product.images[0]?.storageKey;
    const thumbnail = storageKey ? this.mediaService.getPublicUrl(storageKey) : null;
    return WishlistMapper.toItemResponse(item, thumbnail);
  }
}
