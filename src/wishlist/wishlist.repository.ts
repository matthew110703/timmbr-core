import { Injectable } from '@nestjs/common';
import { Prisma, Product, ProductVariant, Wishlist, WishlistItem } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { UserNotFoundException } from '@/common/exceptions/user.exception';
import { WishlistItemAlreadyExistsException } from '@/common/exceptions/wishlist.exception';

const primaryImage = {
  where: { isPrimary: true },
  take: 1,
  select: { storageKey: true },
} as const;

const wishlistItemInclude = {
  product: {
    select: { id: true, title: true, slug: true, status: true, images: primaryImage },
  },
  variant: {
    include: {
      inventory: true,
      attributeValues: {
        include: { definition: true },
        orderBy: { createdAt: 'asc' as const },
      },
      images: primaryImage,
    },
  },
} satisfies Prisma.WishlistItemInclude;

export type WishlistItemWithRelations = Prisma.WishlistItemGetPayload<{
  include: typeof wishlistItemInclude;
}>;

export type WishlistWithItems = Wishlist & {
  items: WishlistItemWithRelations[];
};

export type VariantWithProduct = ProductVariant & {
  product: Pick<Product, 'id' | 'status'>;
};

@Injectable()
export class WishlistRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<Wishlist | null> {
    return this.prisma.wishlist.findUnique({
      where: { userId },
    });
  }

  async findWithItemsByUserId(userId: string): Promise<WishlistWithItems | null> {
    return this.prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          include: wishlistItemInclude,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findOrCreateByUserId(userId: string): Promise<Wishlist> {
    // Read first: the wishlist almost always exists, and a plain lookup is a single query
    const existing = await this.findByUserId(userId);
    if (existing) return existing;

    try {
      return await this.prisma.wishlist.create({
        data: { userId },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Concurrency guard: if another concurrent request created the wishlist simultaneously (P2002), fetch it
        if (error.code === 'P2002') {
          const raceWishlist = await this.findByUserId(userId);
          if (raceWishlist) return raceWishlist;
        }
        // A still-valid access token can outlive its user row (P2003 on the userId foreign key)
        if (error.code === 'P2003') throw new UserNotFoundException();
      }
      throw error;
    }
  }

  async findVariantWithProduct(variantId: string): Promise<VariantWithProduct | null> {
    return this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: { select: { id: true, status: true } },
      },
    });
  }

  async variantExists(variantId: string): Promise<boolean> {
    const count = await this.prisma.productVariant.count({
      where: { id: variantId },
    });
    return count > 0;
  }

  async findItem(wishlistId: string, variantId: string): Promise<WishlistItem | null> {
    return this.prisma.wishlistItem.findUnique({
      where: { wishlistId_variantId: { wishlistId, variantId } },
    });
  }

  async addItem(
    wishlistId: string,
    productId: string,
    variantId: string,
  ): Promise<WishlistItemWithRelations> {
    try {
      return await this.prisma.wishlistItem.create({
        data: { wishlistId, productId, variantId },
        include: wishlistItemInclude,
      });
    } catch (error) {
      // The (wishlistId, variantId) unique constraint is the final duplicate guard under concurrency
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new WishlistItemAlreadyExistsException();
      }
      throw error;
    }
  }

  // Ownership is enforced in the query itself: only items in the given user's wishlist can match
  async removeItemForUser(userId: string, variantId: string): Promise<number> {
    const { count } = await this.prisma.wishlistItem.deleteMany({
      where: { variantId, wishlist: { userId } },
    });
    return count;
  }

  async hasItemForUser(userId: string, variantId: string): Promise<boolean> {
    const count = await this.prisma.wishlistItem.count({
      where: { variantId, wishlist: { userId } },
    });
    return count > 0;
  }
}
