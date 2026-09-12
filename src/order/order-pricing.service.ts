import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderItemInputDto } from './dto/create-order.dto';
import { QuoteItemDto, QuoteResponseDto } from './dto/quote-response.dto';
import {
  OrderInsufficientStockException,
  OrderVariantUnavailableException,
} from '@/common/exceptions/order.exception';
import { AddressNotFoundException } from '@/common/exceptions/address.exception';
import { ProductStatus, VariantStatus } from '@prisma/client';
import { roundToTwoDecimals } from './order.helper';

export interface ValidatedCheckoutData {
  addressSnapshot: {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    type: string;
    label: string;
  };
  calculatedItems: (QuoteItemDto & {
    variant: any;
  })[];
  pricing: QuoteResponseDto;
}

@Injectable()
export class OrderPricingService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateQuoteAndValidate(
    userId: string,
    items: OrderItemInputDto[],
    shippingAddressId: string,
  ): Promise<ValidatedCheckoutData> {
    // 1. Validate address
    const address = await this.prisma.address.findUnique({
      where: { id: shippingAddressId },
    });

    if (!address || address.userId !== userId) {
      throw new AddressNotFoundException();
    }

    const addressSnapshot = {
      id: address.id,
      userId: address.userId,
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      type: address.type,
      label: address.label,
    };

    // 2. Fetch and validate variants
    const variantIds = items.map((i) => i.variantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: {
        product: true,
        inventory: true,
      },
    });

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const calculatedItems: (QuoteItemDto & { variant: any })[] = [];

    for (const item of items) {
      const variant = variantMap.get(item.variantId);
      if (!variant) {
        throw new OrderVariantUnavailableException(item.variantId, 'Variant not found');
      }

      if (variant.status !== VariantStatus.ACTIVE) {
        throw new OrderVariantUnavailableException(variant.sku, 'Variant is not active for sale');
      }

      if (variant.product.status !== ProductStatus.ACTIVE) {
        throw new OrderVariantUnavailableException(variant.sku, 'Product is not published');
      }

      const availableStock = Math.max(
        0,
        (variant.inventory?.quantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0),
      );

      if (availableStock < item.quantity) {
        throw new OrderInsufficientStockException(variant.sku, availableStock, item.quantity);
      }

      const unitPrice = Number(variant.price);
      const totalPrice = roundToTwoDecimals(unitPrice * item.quantity);
      const gstRate = Number(variant.product.gstRate ?? 18);
      const basePrice = totalPrice / (1 + gstRate / 100);
      const taxAmount = roundToTwoDecimals(totalPrice - basePrice);

      calculatedItems.push({
        variantId: variant.id,
        productId: variant.productId,
        name: `${variant.product.title} - ${variant.sku}`,
        sku: variant.sku,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        hsnCode: variant.product.hsnCode,
        gstRate,
        taxAmount,
        variant,
      });
    }

    const subtotal = roundToTwoDecimals(
      calculatedItems.reduce((acc, it) => acc + it.totalPrice, 0),
    );
    const discount = 0;
    const shippingFee = 0;
    const tax = roundToTwoDecimals(calculatedItems.reduce((acc, it) => acc + it.taxAmount, 0));
    const grandTotal = roundToTwoDecimals(subtotal - discount + shippingFee);
    const currency = 'INR';

    const pricing: QuoteResponseDto = {
      items: calculatedItems.map((item) => ({
        variantId: item.variantId,
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        hsnCode: item.hsnCode,
        gstRate: item.gstRate,
        taxAmount: item.taxAmount,
      })),
      subtotal,
      discount,
      shippingFee,
      tax,
      grandTotal,
      currency,
    };

    return {
      addressSnapshot,
      calculatedItems,
      pricing,
    };
  }
}
