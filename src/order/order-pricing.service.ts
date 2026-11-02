import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderItemInputDto } from './dto/create-order.dto';
import { QuoteItemDto, QuoteResponseDto } from './dto/quote-response.dto';
import {
  OrderInsufficientStockException,
  OrderVariantUnavailableException,
} from '@/common/exceptions/order.exception';
import {
  AddressInvalidTypeException,
  AddressNotFoundException,
} from '@/common/exceptions/address.exception';
import { InvoiceInvalidShippingStateException } from '@/common/exceptions/invoice.exception';
import { resolveGstState } from '@/invoice/utils/gst-place-of-supply.util';
import { Address, AddressType, Prisma, ProductStatus, VariantStatus } from '@prisma/client';
import { MAX_ONLINE_PAYMENT_AMOUNT, roundToTwoDecimals } from './order.helper';

export interface AddressSnapshot {
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
}

export interface ValidatedCheckoutData {
  addressSnapshot: AddressSnapshot;
  billingAddressSnapshot: AddressSnapshot;
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
    billingAddressId?: string,
    options?: { ensureBillingAddress?: boolean },
  ): Promise<ValidatedCheckoutData> {
    // 1. Validate shipping address
    const address = await this.prisma.address.findUnique({
      where: { id: shippingAddressId },
    });

    if (!address || address.userId !== userId) {
      throw new AddressNotFoundException();
    }

    if (address.type && address.type !== AddressType.SHIPPING) {
      throw new AddressInvalidTypeException('Shipping address must be of type SHIPPING.');
    }

    if (!resolveGstState(address.state)) {
      throw new InvoiceInvalidShippingStateException(address.state);
    }

    const addressSnapshot = this.toAddressSnapshot(address, AddressType.SHIPPING);

    // 2. Resolve and validate billing address:
    //    - If billingAddressId is provided: must exist, belong to userId, and have type BILLING.
    //    - If billingAddressId is omitted: check if user has a default BILLING address;
    //      if found, use it; otherwise create a default BILLING address from the shipping address info.
    let billingAddressSnapshot: AddressSnapshot;

    if (billingAddressId) {
      const billingAddr = await this.prisma.address.findUnique({
        where: { id: billingAddressId },
      });

      if (!billingAddr || billingAddr.userId !== userId) {
        throw new AddressNotFoundException();
      }

      if (billingAddr.type !== AddressType.BILLING) {
        throw new AddressInvalidTypeException('Billing address must be of type BILLING.');
      }

      if (!resolveGstState(billingAddr.state)) {
        throw new InvoiceInvalidShippingStateException(billingAddr.state);
      }

      billingAddressSnapshot = this.toAddressSnapshot(billingAddr, AddressType.BILLING);
    } else {
      const existingDefaultBilling = await this.prisma.address?.findFirst?.({
        where: {
          userId,
          type: AddressType.BILLING,
          isDefault: true,
        },
      });

      if (existingDefaultBilling) {
        if (!resolveGstState(existingDefaultBilling.state)) {
          throw new InvoiceInvalidShippingStateException(existingDefaultBilling.state);
        }
        billingAddressSnapshot = this.toAddressSnapshot(
          existingDefaultBilling,
          AddressType.BILLING,
        );
      } else if (options?.ensureBillingAddress && this.prisma.address?.create) {
        const createdBilling = await this.prisma.address.create({
          data: {
            userId,
            firstName: address.firstName,
            lastName: address.lastName,
            phone: address.phone,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country,
            latitude: address.latitude ?? null,
            longitude: address.longitude ?? null,
            type: AddressType.BILLING,
            label: address.label,
            isDefault: true,
          },
        });
        billingAddressSnapshot = this.toAddressSnapshot(createdBilling, AddressType.BILLING);
      } else {
        billingAddressSnapshot = {
          ...addressSnapshot,
          type: AddressType.BILLING,
        };
      }
    }

    // 3. Fetch and validate variants
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

      const unitPriceDec = new Prisma.Decimal(variant.price).toDecimalPlaces(
        2,
        Prisma.Decimal.ROUND_HALF_UP,
      );
      const compareAtDec =
        variant.compareAtPrice !== null && variant.compareAtPrice !== undefined
          ? new Prisma.Decimal(variant.compareAtPrice).toDecimalPlaces(
              2,
              Prisma.Decimal.ROUND_HALF_UP,
            )
          : null;

      const originalUnitPriceDec =
        compareAtDec && compareAtDec.gt(unitPriceDec) ? compareAtDec : unitPriceDec;
      const discountAmountDec = originalUnitPriceDec
        .minus(unitPriceDec)
        .mul(item.quantity)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      const totalPriceDec = unitPriceDec
        .mul(item.quantity)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const gstRateDec = new Prisma.Decimal(variant.product.gstRate ?? 18).toDecimalPlaces(
        2,
        Prisma.Decimal.ROUND_HALF_UP,
      );
      const divisor = new Prisma.Decimal(1).plus(gstRateDec.div(100));
      const basePriceDec = totalPriceDec
        .div(divisor)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const taxAmountDec = totalPriceDec
        .minus(basePriceDec)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      const unitPrice = Number(unitPriceDec);
      const originalUnitPrice = Number(originalUnitPriceDec);
      const discountAmount = Number(discountAmountDec);
      const totalPrice = Number(totalPriceDec);
      const gstRate = Number(gstRateDec);
      const taxAmount = Number(taxAmountDec);

      calculatedItems.push({
        variantId: variant.id,
        productId: variant.productId,
        name: `${variant.product.title} - ${variant.sku}`,
        sku: variant.sku,
        quantity: item.quantity,
        originalUnitPrice,
        unitPrice,
        discountAmount,
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
        originalUnitPrice: item.originalUnitPrice,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
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
      paymentLimit: MAX_ONLINE_PAYMENT_AMOUNT,
    };

    return {
      addressSnapshot,
      billingAddressSnapshot,
      calculatedItems,
      pricing,
    };
  }

  private toAddressSnapshot(address: Address, fallbackType: AddressType): AddressSnapshot {
    return {
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
      type: address.type ?? fallbackType,
      label: address.label,
    };
  }
}
