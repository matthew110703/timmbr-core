import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Cart, CartItem, CartStatus, Prisma } from '@prisma/client';
import { CartItemNotFoundException } from '@/common/exceptions/cart.exception';
import { roundToTwoDecimals } from './cart.helper';
import { CART_CONSTANTS } from './cart.constants';

export type CartWithItems = Cart & {
  items: CartItem[];
};

export interface UpsertCartItemData {
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  metaData?: Prisma.InputJsonValue;
}

export interface PriceUpdateItem {
  itemId: string;
  unitPrice: number;
  totalPrice: number;
}

@Injectable()
export class CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveCartByUserId(userId: string): Promise<CartWithItems | null> {
    return this.prisma.cart.findFirst({
      where: {
        userId,
        status: CartStatus.ACTIVE,
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  // Alias for backward compatibility
  async findCartByUserId(userId: string): Promise<CartWithItems | null> {
    return this.findActiveCartByUserId(userId);
  }

  async findOrCreateCart(userId: string): Promise<CartWithItems> {
    const existing = await this.findActiveCartByUserId(userId);
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.cart.create({
        data: {
          userId,
          status: CartStatus.ACTIVE,
          subtotal: new Prisma.Decimal(0),
          grandTotal: new Prisma.Decimal(0),
          currency: CART_CONSTANTS.DEFAULT_CURRENCY,
        },
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    } catch (error) {
      // Concurrency guard: if another concurrent request created the active cart simultaneously (P2002), fetch it
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raceCart = await this.findActiveCartByUserId(userId);
        if (raceCart) return raceCart;
      }
      throw error;
    }
  }

  async markCartConverted(cartId: string): Promise<void> {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { status: CartStatus.CONVERTED },
    });
  }

  async upsertCartItem(
    cartId: string,
    data: UpsertCartItemData,
  ): Promise<{ item: CartItem; subtotal: string; grandTotal: string }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.cartItem.findUnique({
        where: {
          cartId_variantId: {
            cartId,
            variantId: data.variantId,
          },
        },
      });

      let updatedItem: CartItem;
      if (existing) {
        const newQuantity = existing.quantity + data.quantity;
        const newTotalPrice = roundToTwoDecimals(data.unitPrice * newQuantity);
        updatedItem = await tx.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: newQuantity,
            unitPrice: new Prisma.Decimal(data.unitPrice),
            totalPrice: new Prisma.Decimal(newTotalPrice),
            name: data.name,
            sku: data.sku,
            metaData:
              data.metaData ?? (existing.metaData as Prisma.InputJsonValue) ?? Prisma.DbNull,
          },
        });
      } else {
        updatedItem = await tx.cartItem.create({
          data: {
            cartId,
            productId: data.productId,
            variantId: data.variantId,
            name: data.name,
            sku: data.sku,
            quantity: data.quantity,
            unitPrice: new Prisma.Decimal(data.unitPrice),
            totalPrice: new Prisma.Decimal(data.totalPrice),
            metaData: data.metaData ?? Prisma.DbNull,
          },
        });
      }

      // Recalculate totals
      const allItems = await tx.cartItem.findMany({ where: { cartId } });
      const total = allItems.reduce((acc, it) => acc + Number(it.totalPrice), 0);
      const subtotalFormatted = roundToTwoDecimals(total).toFixed(2);

      await tx.cart.update({
        where: { id: cartId },
        data: {
          subtotal: new Prisma.Decimal(subtotalFormatted),
          grandTotal: new Prisma.Decimal(subtotalFormatted),
        },
      });

      return {
        item: updatedItem,
        subtotal: subtotalFormatted,
        grandTotal: subtotalFormatted,
      };
    });
  }

  async updateCartItemQuantity(
    cartId: string,
    itemId: string,
    quantity: number,
    unitPrice: number,
    totalPrice: number,
  ): Promise<{ item: CartItem; subtotal: string; grandTotal: string }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.cartItem.findUnique({ where: { id: itemId } });
      if (!existing || existing.cartId !== cartId) {
        throw new CartItemNotFoundException();
      }

      const updatedItem = await tx.cartItem.update({
        where: { id: itemId },
        data: {
          quantity,
          unitPrice: new Prisma.Decimal(unitPrice),
          totalPrice: new Prisma.Decimal(totalPrice),
        },
      });

      const allItems = await tx.cartItem.findMany({ where: { cartId } });
      const total = allItems.reduce((acc, it) => acc + Number(it.totalPrice), 0);
      const subtotalFormatted = roundToTwoDecimals(total).toFixed(2);

      await tx.cart.update({
        where: { id: cartId },
        data: {
          subtotal: new Prisma.Decimal(subtotalFormatted),
          grandTotal: new Prisma.Decimal(subtotalFormatted),
        },
      });

      return {
        item: updatedItem,
        subtotal: subtotalFormatted,
        grandTotal: subtotalFormatted,
      };
    });
  }

  async deleteCartItem(
    cartId: string,
    itemId: string,
  ): Promise<{ subtotal: string; grandTotal: string }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.cartItem.findUnique({ where: { id: itemId } });
      if (!existing || existing.cartId !== cartId) {
        throw new CartItemNotFoundException();
      }

      await tx.cartItem.delete({ where: { id: itemId } });

      const allItems = await tx.cartItem.findMany({ where: { cartId } });
      const total = allItems.reduce((acc, it) => acc + Number(it.totalPrice), 0);
      const subtotalFormatted = roundToTwoDecimals(total).toFixed(2);

      await tx.cart.update({
        where: { id: cartId },
        data: {
          subtotal: new Prisma.Decimal(subtotalFormatted),
          grandTotal: new Prisma.Decimal(subtotalFormatted),
        },
      });

      return {
        subtotal: subtotalFormatted,
        grandTotal: subtotalFormatted,
      };
    });
  }

  async clearCart(cartId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.cartItem.deleteMany({ where: { cartId } }),
      this.prisma.cart.update({
        where: { id: cartId },
        data: {
          subtotal: new Prisma.Decimal(0),
          grandTotal: new Prisma.Decimal(0),
        },
      }),
    ]);
  }

  async syncPricesBatch(
    cartId: string,
    updates: PriceUpdateItem[],
    subtotal: string,
    grandTotal: string,
  ): Promise<void> {
    if (updates.length === 0) return;

    await this.prisma.$transaction([
      ...updates.map((u) =>
        this.prisma.cartItem.update({
          where: { id: u.itemId },
          data: {
            unitPrice: new Prisma.Decimal(u.unitPrice),
            totalPrice: new Prisma.Decimal(u.totalPrice),
          },
        }),
      ),
      this.prisma.cart.update({
        where: { id: cartId },
        data: {
          subtotal: new Prisma.Decimal(subtotal),
          grandTotal: new Prisma.Decimal(grandTotal),
        },
      }),
    ]);
  }

  async executeInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
