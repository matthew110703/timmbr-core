import { Order, OrderItem, Payment } from '@prisma/client';
import {
  AdminOrderListItemDto,
  OrderItemResponseDto,
  OrderResponseDto,
} from './dto/order-response.dto';
import { PaymentMapper } from '@/payment/payment.mapper';

type ImageRef = { images: { storageKey: string }[] } | null;

/** Items may carry their variant / product primary image (see OrderRepository). */
export type OrderItemWithImages = OrderItem & { variant?: ImageRef; product?: ImageRef };

export type OrderWithRelations = Order & {
  items: OrderItemWithImages[];
  payments?: Payment[];
};

/** Turns a storage key into a public URL (MediaService.getPublicUrl). */
export type ThumbnailResolver = (storageKey: string) => string;

export class OrderMapper {
  static toItemResponse(
    item: OrderItemWithImages,
    resolveThumbnail?: ThumbnailResolver,
  ): OrderItemResponseDto {
    // Variant image first, then the product's; null once both are gone.
    const storageKey =
      item.variant?.images?.[0]?.storageKey ?? item.product?.images?.[0]?.storageKey;
    return {
      id: item.id,
      orderId: item.orderId,
      productId: item.productId ?? null,
      variantId: item.variantId ?? null,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      hsnCode: item.hsnCode ?? null,
      gstRate: Number(item.gstRate),
      taxAmount: Number(item.taxAmount),
      metadata: item.metadata,
      thumbnail: storageKey && resolveThumbnail ? resolveThumbnail(storageKey) : null,
      createdAt: item.createdAt,
    };
  }

  static toResponse(
    order: OrderWithRelations,
    resolveThumbnail?: ThumbnailResolver,
  ): OrderResponseDto {
    return {
      id: order.id,
      userId: order.userId,
      cartId: order.cartId ?? null,
      status: order.status,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      shippingFee: Number(order.shippingFee),
      tax: Number(order.tax),
      grandTotal: Number(order.grandTotal),
      currency: order.currency,
      shippingAddressId: order.shippingAddressId ?? null,
      shippingAddress: order.shippingAddress,
      placedAt: order.placedAt ?? null,
      expiresAt: order.expiresAt ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: (order.items || []).map((item) => OrderMapper.toItemResponse(item, resolveThumbnail)),
      payments: order.payments?.map((payment) => PaymentMapper.toResponse(payment)),
    };
  }

  static toAdminListItem(order: any): AdminOrderListItemDto {
    const shippingAddr = order.shippingAddress as Record<string, any> | null;
    const customerName =
      order.user?.name ||
      (shippingAddr
        ? `${shippingAddr.firstName ?? ''} ${shippingAddr.lastName ?? ''}`.trim()
        : 'Customer');
    const customerEmail = order.user?.email || shippingAddr?.email || '';
    const customerPhone = order.user?.phone || shippingAddr?.phone || null;

    return {
      id: order.id,
      status: order.status,
      paymentStatus: order.payments?.[0]?.status ?? null,
      grandTotal: Number(order.grandTotal),
      currency: order.currency,
      itemsCount: order._count?.items ?? order.items?.length ?? 0,
      customer: {
        id: order.userId,
        name: customerName || 'Customer',
        email: customerEmail,
        phone: customerPhone,
      },
      placedAt: order.placedAt ?? null,
      expiresAt: order.expiresAt ?? null,
      createdAt: order.createdAt,
    };
  }
}
