import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MediaService } from '@/media/media.service';
import { CartItemResponseDto } from './dto/cart-item-response.dto';
import { PriceUpdateItem } from './cart.repository';
import { formatAmount, roundToTwoDecimals } from './cart.helper';
import { CART_CONSTANTS } from './cart.constants';
import { ProductStatus, VariantStatus } from '@prisma/client';

export interface RawCartItemInput {
  id: string;
  cartId: string;
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number | string;
  totalPrice: number | string;
  metaData?: Record<string, unknown> | null;
}

export interface PriceSyncResult {
  items: CartItemResponseDto[];
  subtotal: string;
  grandTotal: string;
  currency: string;
  hasDrift: boolean;
  driftUpdates: PriceUpdateItem[];
}

@Injectable()
export class CartPricingSync {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async syncAndEnrichItems(items: RawCartItemInput[]): Promise<PriceSyncResult> {
    if (items.length === 0) {
      return {
        items: [],
        subtotal: '0.00',
        grandTotal: '0.00',
        currency: CART_CONSTANTS.DEFAULT_CURRENCY,
        hasDrift: false,
        driftUpdates: [],
      };
    }

    // 1. Collect distinct variant IDs
    const variantIds = Array.from(new Set(items.map((i) => i.variantId)));

    // 2. Single batch query for all active variants, products, images, and inventory
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            status: true,
            gstRate: true,
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { storageKey: true },
            },
          },
        },
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { storageKey: true },
        },
        inventory: {
          select: { quantity: true, reservedQuantity: true },
        },
        attributeValues: {
          include: {
            definition: { select: { name: true } },
          },
        },
      },
    });

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const enrichedItems: CartItemResponseDto[] = [];
    const driftUpdates: PriceUpdateItem[] = [];
    let hasDrift = false;
    let runningSubtotal = 0;

    for (const item of items) {
      const variant = variantMap.get(item.variantId);
      const isVariantActive = Boolean(
        variant &&
        variant.status === VariantStatus.ACTIVE &&
        variant.product?.status === ProductStatus.ACTIVE,
      );

      let currentUnitPrice = Number(item.unitPrice);
      let isAvailable = false;
      let availableQuantity = 0;
      let thumbnail: string | null = null;
      let attributes: Record<string, string> | undefined = undefined;

      if (variant) {
        // Stock availability
        availableQuantity = Math.max(
          0,
          (variant.inventory?.quantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0),
        );
        isAvailable = isVariantActive && availableQuantity > 0;

        // Current catalog price
        const catalogPrice = Number(variant.price);
        if (catalogPrice !== currentUnitPrice) {
          currentUnitPrice = catalogPrice;
          hasDrift = true;
          driftUpdates.push({
            itemId: item.id,
            unitPrice: currentUnitPrice,
            totalPrice: roundToTwoDecimals(currentUnitPrice * item.quantity),
          });
        }

        // Thumbnail resolution (variant primary image > product primary image)
        const storageKey = variant.images[0]?.storageKey || variant.product.images[0]?.storageKey;
        if (storageKey) {
          thumbnail = this.mediaService.getPublicUrl(storageKey);
        }

        // Attributes resolution
        if (variant.attributeValues && variant.attributeValues.length > 0) {
          attributes = {};
          for (const attr of variant.attributeValues) {
            if (attr.definition?.name) {
              attributes[attr.definition.name] = attr.value;
            }
          }
        }
      }

      const itemTotal = roundToTwoDecimals(currentUnitPrice * item.quantity);
      runningSubtotal += itemTotal;

      enrichedItems.push({
        id: item.id,
        cartId: item.cartId,
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: formatAmount(currentUnitPrice),
        totalPrice: formatAmount(itemTotal),
        currency: CART_CONSTANTS.DEFAULT_CURRENCY,
        thumbnail,
        attributes,
        isAvailable,
        availableQuantity,
        metaData: item.metaData ?? null,
      });
    }

    const subtotalFormatted = formatAmount(runningSubtotal);

    return {
      items: enrichedItems,
      subtotal: subtotalFormatted,
      grandTotal: subtotalFormatted,
      currency: CART_CONSTANTS.DEFAULT_CURRENCY,
      hasDrift,
      driftUpdates,
    };
  }
}
