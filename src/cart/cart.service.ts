import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { CartRepository } from './cart.repository';
import { CartRedisRepository } from './cart-redis.repository';
import { CartPricingSync } from './cart.pricing-sync';
import { CartMapper } from './cart.mapper';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { CartCountResponse } from './dto/cart-count-response.dto';
import { CartContext, RedisCart, RedisCartItem } from './types/cart.types';
import {
  CartItemNotFoundException,
  CartItemOutOfStockException,
  CartNotFoundException,
  CartQuantityLimitException,
  CartVariantUnavailableException,
} from '@/common/exceptions/cart.exception';
import {
  calculateCartTotals,
  formatAmount,
  freeStock,
  maxLineQuantity,
  roundToTwoDecimals,
  type StockRow,
} from './cart.helper';
import { CART_CONSTANTS } from './cart.constants';
import { Prisma, ProductStatus, VariantStatus } from '@prisma/client';

const STOCK_SELECT = { select: { quantity: true, reservedQuantity: true } } as const;

/**
 * Throws when a cart line can't hold `quantity`: out of stock (with what's left) when stock is
 * the limit, otherwise the per-item limit. Adding to the cart never reserves stock; orders do.
 */
export function assertLineQuantity(quantity: number, inventory: StockRow): void {
  const available = freeStock(inventory);
  if (quantity <= Math.min(available, CART_CONSTANTS.MAX_ITEM_QUANTITY)) return;
  if (available < CART_CONSTANTS.MAX_ITEM_QUANTITY) {
    throw new CartItemOutOfStockException(available);
  }
  throw new CartQuantityLimitException(CART_CONSTANTS.MAX_ITEM_QUANTITY);
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartRepository: CartRepository,
    private readonly cartRedisRepository: CartRedisRepository,
    private readonly cartPricingSync: CartPricingSync,
  ) {}

  async getCart(context: CartContext): Promise<CartResponseDto> {
    if (context.userId) {
      const cart = await this.cartRepository.findActiveCartByUserId(context.userId);
      if (!cart || cart.items.length === 0) {
        return CartMapper.toEmptyResponse();
      }

      const syncResult = await this.cartPricingSync.syncAndEnrichItems(
        cart.items.map((i) => ({
          id: i.id,
          cartId: i.cartId,
          productId: i.productId,
          variantId: i.variantId,
          name: i.name,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          totalPrice: Number(i.totalPrice),
          metaData: i.metaData as Record<string, unknown> | null,
        })),
      );

      if (syncResult.hasDrift) {
        await this.cartRepository.syncPricesBatch(
          cart.id,
          syncResult.driftUpdates,
          syncResult.subtotal,
          syncResult.grandTotal,
        );
      }

      return CartMapper.toResponse(cart.id, syncResult);
    }

    if (context.guestCartId) {
      const redisCart = await this.cartRedisRepository.getGuestCart(context.guestCartId);
      if (!redisCart || redisCart.items.length === 0) {
        return CartMapper.toEmptyResponse();
      }

      const syncResult = await this.cartPricingSync.syncAndEnrichItems(redisCart.items);

      if (syncResult.hasDrift) {
        const driftMap = new Map(syncResult.driftUpdates.map((u) => [u.itemId, u]));
        for (const item of redisCart.items) {
          const update = driftMap.get(item.id);
          if (update) {
            item.unitPrice = formatAmount(update.unitPrice);
            item.totalPrice = formatAmount(update.totalPrice);
            item.updatedAt = new Date().toISOString();
          }
        }
        redisCart.subtotal = syncResult.subtotal;
        redisCart.grandTotal = syncResult.grandTotal;
        redisCart.updatedAt = new Date().toISOString();
        await this.cartRedisRepository.saveGuestCart(context.guestCartId, redisCart);
      }

      return CartMapper.toResponse(redisCart.id, syncResult);
    }

    return CartMapper.toEmptyResponse();
  }

  /**
   * Units in the cart and which variants they are: the header badge, and "in your cart" on
   * product pages. Cheap: no re-pricing, no product data.
   */
  async getCount(context: CartContext): Promise<CartCountResponse> {
    let lines: { variantId: string; quantity: number }[] = [];
    if (context.userId) {
      lines = await this.cartRepository.findActiveLines(context.userId);
    } else if (context.guestCartId) {
      const redisCart = await this.cartRedisRepository.getGuestCart(context.guestCartId);
      lines = (redisCart?.items ?? []).map(({ variantId, quantity }) => ({ variantId, quantity }));
    }
    return {
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      items: lines.map(({ variantId, quantity }) => ({ variantId, quantity })),
    };
  }

  async addItem(
    context: CartContext,
    dto: AddCartItemDto,
  ): Promise<{ cart: CartResponseDto; newGuestCartId?: string }> {
    // 1. Authoritative variant & product validation
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: {
        product: {
          select: { id: true, title: true, status: true, gstRate: true },
        },
        inventory: STOCK_SELECT,
      },
    });

    if (
      !variant ||
      variant.status !== VariantStatus.ACTIVE ||
      variant.product.status !== ProductStatus.ACTIVE
    ) {
      throw new CartVariantUnavailableException(dto.variantId);
    }

    const unitPrice = Number(variant.price);
    const totalPrice = roundToTwoDecimals(unitPrice * dto.quantity);
    const name = `${variant.product.title} - ${variant.sku}`;

    // 2. Authenticated branch
    if (context.userId) {
      const cart = await this.cartRepository.findOrCreateCart(context.userId);
      const inCart = cart.items?.find((i) => i.variantId === variant.id)?.quantity ?? 0;
      assertLineQuantity(inCart + dto.quantity, variant.inventory);

      await this.cartRepository.upsertCartItem(cart.id, {
        productId: variant.productId,
        variantId: variant.id,
        name,
        sku: variant.sku,
        quantity: dto.quantity,
        unitPrice,
        totalPrice,
      });

      const updatedCart = await this.cartRepository.findActiveCartByUserId(context.userId);
      const syncResult = await this.cartPricingSync.syncAndEnrichItems(
        updatedCart!.items.map((i) => ({
          id: i.id,
          cartId: i.cartId,
          productId: i.productId,
          variantId: i.variantId,
          name: i.name,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          totalPrice: Number(i.totalPrice),
          metaData: i.metaData as Record<string, unknown> | null,
        })),
      );

      if (syncResult.hasDrift) {
        await this.cartRepository.syncPricesBatch(
          cart.id,
          syncResult.driftUpdates,
          syncResult.subtotal,
          syncResult.grandTotal,
        );
      }

      return { cart: CartMapper.toResponse(cart.id, syncResult) };
    }

    // 3. Guest branch
    let guestCartId = context.guestCartId;
    let newGuestCartId: string | undefined = undefined;
    let redisCart: RedisCart | null = null;

    if (guestCartId) {
      redisCart = await this.cartRedisRepository.getGuestCart(guestCartId);
    }

    if (!guestCartId || !redisCart) {
      guestCartId = randomUUID();
      newGuestCartId = guestCartId;
      redisCart = {
        id: guestCartId,
        status: 'ACTIVE',
        subtotal: '0.00',
        grandTotal: '0.00',
        currency: CART_CONSTANTS.DEFAULT_CURRENCY,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const existingIndex = redisCart.items.findIndex((i) => i.variantId === dto.variantId);
    const inCart = existingIndex > -1 ? redisCart.items[existingIndex].quantity : 0;
    assertLineQuantity(inCart + dto.quantity, variant.inventory);
    if (existingIndex > -1) {
      const existing = redisCart.items[existingIndex];
      const newQty = existing.quantity + dto.quantity;
      existing.quantity = newQty;
      existing.unitPrice = formatAmount(unitPrice);
      existing.totalPrice = formatAmount(unitPrice * newQty);
      existing.updatedAt = new Date().toISOString();
    } else {
      const newItem: RedisCartItem = {
        id: randomUUID(),
        cartId: guestCartId,
        productId: variant.productId,
        variantId: variant.id,
        name,
        sku: variant.sku,
        quantity: dto.quantity,
        unitPrice: formatAmount(unitPrice),
        totalPrice: formatAmount(totalPrice),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      redisCart.items.push(newItem);
    }

    const totals = calculateCartTotals(redisCart.items);
    redisCart.subtotal = totals.subtotal;
    redisCart.grandTotal = totals.grandTotal;
    redisCart.updatedAt = new Date().toISOString();

    await this.cartRedisRepository.saveGuestCart(guestCartId, redisCart);

    const syncResult = await this.cartPricingSync.syncAndEnrichItems(redisCart.items);
    return {
      cart: CartMapper.toResponse(redisCart.id, syncResult),
      newGuestCartId,
    };
  }

  async updateItemQuantity(
    context: CartContext,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    if (context.userId) {
      const cart = await this.cartRepository.findActiveCartByUserId(context.userId);
      if (!cart) throw new CartNotFoundException();

      const item = cart.items.find((i) => i.id === itemId);
      if (!item) throw new CartItemNotFoundException();

      const variant = await this.prisma.productVariant.findUnique({
        where: { id: item.variantId },
        include: { inventory: STOCK_SELECT },
      });
      // Lowering a quantity is always allowed; raising it must fit the stock.
      if (dto.quantity > item.quantity) {
        assertLineQuantity(dto.quantity, variant?.inventory ?? null);
      }
      const unitPrice = variant ? Number(variant.price) : Number(item.unitPrice);
      const totalPrice = roundToTwoDecimals(unitPrice * dto.quantity);

      await this.cartRepository.updateCartItemQuantity(
        cart.id,
        itemId,
        dto.quantity,
        unitPrice,
        totalPrice,
      );

      const updatedCart = await this.cartRepository.findActiveCartByUserId(context.userId);
      const syncResult = await this.cartPricingSync.syncAndEnrichItems(
        updatedCart!.items.map((i) => ({
          id: i.id,
          cartId: i.cartId,
          productId: i.productId,
          variantId: i.variantId,
          name: i.name,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          totalPrice: Number(i.totalPrice),
          metaData: i.metaData as Record<string, unknown> | null,
        })),
      );

      if (syncResult.hasDrift) {
        await this.cartRepository.syncPricesBatch(
          cart.id,
          syncResult.driftUpdates,
          syncResult.subtotal,
          syncResult.grandTotal,
        );
      }

      return CartMapper.toResponse(cart.id, syncResult);
    }

    if (context.guestCartId) {
      const redisCart = await this.cartRedisRepository.getGuestCart(context.guestCartId);
      if (!redisCart) throw new CartNotFoundException();

      const item = redisCart.items.find((i) => i.id === itemId);
      if (!item) throw new CartItemNotFoundException();

      const variant = await this.prisma.productVariant.findUnique({
        where: { id: item.variantId },
        include: { inventory: STOCK_SELECT },
      });
      if (dto.quantity > item.quantity) {
        assertLineQuantity(dto.quantity, variant?.inventory ?? null);
      }
      const unitPrice = variant ? Number(variant.price) : Number(item.unitPrice);

      item.quantity = dto.quantity;
      item.unitPrice = formatAmount(unitPrice);
      item.totalPrice = formatAmount(unitPrice * dto.quantity);
      item.updatedAt = new Date().toISOString();

      const totals = calculateCartTotals(redisCart.items);
      redisCart.subtotal = totals.subtotal;
      redisCart.grandTotal = totals.grandTotal;
      redisCart.updatedAt = new Date().toISOString();

      await this.cartRedisRepository.saveGuestCart(context.guestCartId, redisCart);

      const syncResult = await this.cartPricingSync.syncAndEnrichItems(redisCart.items);
      return CartMapper.toResponse(redisCart.id, syncResult);
    }

    throw new CartNotFoundException();
  }

  async removeItem(context: CartContext, itemId: string): Promise<CartResponseDto> {
    if (context.userId) {
      const cart = await this.cartRepository.findActiveCartByUserId(context.userId);
      if (!cart) throw new CartNotFoundException();

      const item = cart.items.find((i) => i.id === itemId);
      if (!item) throw new CartItemNotFoundException();

      await this.cartRepository.deleteCartItem(cart.id, itemId);

      const updatedCart = await this.cartRepository.findActiveCartByUserId(context.userId);
      if (!updatedCart || updatedCart.items.length === 0) {
        return {
          id: cart.id,
          items: [],
          subtotal: '0.00',
          grandTotal: '0.00',
          currency: CART_CONSTANTS.DEFAULT_CURRENCY,
        };
      }

      const syncResult = await this.cartPricingSync.syncAndEnrichItems(
        updatedCart.items.map((i) => ({
          id: i.id,
          cartId: i.cartId,
          productId: i.productId,
          variantId: i.variantId,
          name: i.name,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          totalPrice: Number(i.totalPrice),
          metaData: i.metaData as Record<string, unknown> | null,
        })),
      );

      return CartMapper.toResponse(cart.id, syncResult);
    }

    if (context.guestCartId) {
      const redisCart = await this.cartRedisRepository.getGuestCart(context.guestCartId);
      if (!redisCart) throw new CartNotFoundException();

      const index = redisCart.items.findIndex((i) => i.id === itemId);
      if (index === -1) throw new CartItemNotFoundException();

      redisCart.items.splice(index, 1);

      const totals = calculateCartTotals(redisCart.items);
      redisCart.subtotal = totals.subtotal;
      redisCart.grandTotal = totals.grandTotal;
      redisCart.updatedAt = new Date().toISOString();

      await this.cartRedisRepository.saveGuestCart(context.guestCartId, redisCart);

      const syncResult = await this.cartPricingSync.syncAndEnrichItems(redisCart.items);
      return CartMapper.toResponse(redisCart.id, syncResult);
    }

    throw new CartNotFoundException();
  }

  async clearCart(
    context: CartContext,
  ): Promise<{ cart: CartResponseDto; shouldClearCookie: boolean }> {
    if (context.userId) {
      const cart = await this.cartRepository.findActiveCartByUserId(context.userId);
      if (cart) {
        await this.cartRepository.clearCart(cart.id);
      }
      return {
        cart: CartMapper.toEmptyResponse(),
        shouldClearCookie: false,
      };
    }

    if (context.guestCartId) {
      await this.cartRedisRepository.deleteGuestCart(context.guestCartId);
      return {
        cart: CartMapper.toEmptyResponse(),
        shouldClearCookie: true,
      };
    }

    return {
      cart: CartMapper.toEmptyResponse(),
      shouldClearCookie: false,
    };
  }

  async mergeCart(userId: string, guestCartId: string | null): Promise<CartResponseDto> {
    if (!guestCartId) {
      return this.getCart({ userId, guestCartId: null });
    }

    const guestCart = await this.cartRedisRepository.getGuestCart(guestCartId);
    if (!guestCart || guestCart.items.length === 0) {
      try {
        await this.cartRedisRepository.deleteGuestCart(guestCartId);
      } catch (err) {
        this.logger.warn(`Failed to clean up empty guest cart in Redis during merge:`, err);
      }
      return this.getCart({ userId, guestCartId: null });
    }

    const authCart = await this.cartRepository.findOrCreateCart(userId);
    const guestVariantIds = guestCart.items.map((i) => i.variantId);

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: guestVariantIds } },
      include: {
        product: { select: { id: true, title: true, status: true } },
        inventory: STOCK_SELECT,
      },
    });

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    await this.cartRepository.executeInTransaction(async (tx) => {
      const currentAuthItems = await tx.cartItem.findMany({ where: { cartId: authCart.id } });
      const authItemMap = new Map(currentAuthItems.map((i) => [i.variantId, i]));

      for (const guestItem of guestCart.items) {
        const variant = variantMap.get(guestItem.variantId);
        if (
          !variant ||
          variant.status !== VariantStatus.ACTIVE ||
          variant.product.status !== ProductStatus.ACTIVE
        ) {
          continue; // Skip inactive/deleted variants during merge
        }

        const catalogPrice = Number(variant.price);
        const existingAuthItem = authItemMap.get(guestItem.variantId);
        // A merged line never exceeds what can be sold (nor the per-item limit), but never
        // shrinks a line the account already had.
        const cap = Math.max(maxLineQuantity(variant.inventory), existingAuthItem?.quantity ?? 0);

        if (existingAuthItem) {
          const newQty = Math.min(existingAuthItem.quantity + guestItem.quantity, cap);
          const newTotal = roundToTwoDecimals(catalogPrice * newQty);
          await tx.cartItem.update({
            where: { id: existingAuthItem.id },
            data: {
              quantity: newQty,
              unitPrice: new Prisma.Decimal(catalogPrice),
              totalPrice: new Prisma.Decimal(newTotal),
              name: `${variant.product.title} - ${variant.sku}`,
              sku: variant.sku,
            },
          });
        } else {
          const quantity = Math.min(guestItem.quantity, cap);
          if (quantity < 1) continue; // Sold out since it was added
          const newTotal = roundToTwoDecimals(catalogPrice * quantity);
          await tx.cartItem.create({
            data: {
              cartId: authCart.id,
              productId: variant.productId,
              variantId: variant.id,
              name: `${variant.product.title} - ${variant.sku}`,
              sku: variant.sku,
              quantity,
              unitPrice: new Prisma.Decimal(catalogPrice),
              totalPrice: new Prisma.Decimal(newTotal),
              metaData: (guestItem.metaData as Prisma.InputJsonValue) ?? Prisma.DbNull,
            },
          });
        }
      }

      // Recalculate totals
      const allItems = await tx.cartItem.findMany({ where: { cartId: authCart.id } });
      const sum = allItems.reduce((acc, it) => acc + Number(it.totalPrice), 0);
      const formatted = roundToTwoDecimals(sum).toFixed(2);
      await tx.cart.update({
        where: { id: authCart.id },
        data: {
          subtotal: new Prisma.Decimal(formatted),
          grandTotal: new Prisma.Decimal(formatted),
        },
      });
    });

    // Idempotent post-commit Redis cleanup
    try {
      await this.cartRedisRepository.deleteGuestCart(guestCartId);
    } catch (err) {
      this.logger.warn(`Post-commit Redis deletion failed for guestCartId ${guestCartId}:`, err);
    }

    return this.getCart({ userId, guestCartId: null });
  }
}
