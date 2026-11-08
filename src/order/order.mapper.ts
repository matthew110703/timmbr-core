import {
  InvoicePdfStatus,
  InvoiceStatus,
  Order,
  OrderActivity,
  OrderItem,
  OrderNotificationDelivery,
  Payment,
  PaymentStatus,
  UserRole,
} from '@prisma/client';
import {
  AdminOrderListItemDto,
  OrderInvoiceSummaryDto,
  OrderItemResponseDto,
  OrderResponseDto,
} from './dto/order-response.dto';
import { OrderActivityResponseDto } from './dto/order-activity.dto';
import { formatOrderNumber } from './order.helper';
import { PaymentMapper } from '@/payment/payment.mapper';

type ImageRef = { images: { storageKey: string }[] } | null;

/** Items may carry their variant / product primary image (see OrderRepository). */
export type OrderItemWithImages = OrderItem & {
  variant?: ImageRef;
  product?: { slug: string; images: { storageKey: string }[] } | null;
};

export type OrderInvoiceSummaryRecord = {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  pdfStatus: InvoicePdfStatus;
  issuedAt: Date;
};

export type OrderWithRelations = Order & {
  items: OrderItemWithImages[];
  payments?: Payment[];
  invoice?: OrderInvoiceSummaryRecord | null;
  user?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  } | null;
};

export type OrderActivityWithRelations = OrderActivity & {
  staff?: {
    id: string;
    name: string;
    role: UserRole;
  } | null;
  notification?: OrderNotificationDelivery | null;
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
      ...(item.originalUnitPrice !== undefined &&
        item.originalUnitPrice !== null && {
          originalUnitPrice: Number(item.originalUnitPrice),
        }),
      unitPrice: Number(item.unitPrice),
      ...(item.discountAmount !== undefined &&
        item.discountAmount !== null && {
          discountAmount: Number(item.discountAmount),
        }),
      totalPrice: Number(item.totalPrice),
      hsnCode: item.hsnCode ?? null,
      gstRate: Number(item.gstRate),
      taxAmount: Number(item.taxAmount),
      metadata: item.metadata,
      thumbnail: storageKey && resolveThumbnail ? resolveThumbnail(storageKey) : null,
      productSlug: item.product?.slug ?? null,
      createdAt: item.createdAt,
    };
  }

  static toInvoiceSummary(
    invoice?: OrderInvoiceSummaryRecord | null,
  ): OrderInvoiceSummaryDto | null {
    if (!invoice) return null;
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      pdfStatus: invoice.pdfStatus,
      issuedAt: invoice.issuedAt,
    };
  }

  static toResponse(
    order: OrderWithRelations,
    resolveThumbnail?: ThumbnailResolver,
  ): OrderResponseDto {
    const paidOrLatestPayment =
      order.payments?.find((p) => p.status === PaymentStatus.PAID) ?? order.payments?.[0];
    const installationRequired = (order.items || []).some((item) => {
      const meta = item.metadata as Record<string, unknown> | null | undefined;
      return Boolean(meta?.installationRequired || meta?.installation);
    });

    return {
      id: order.id,
      orderNumber: formatOrderNumber(order.id),
      userId: order.userId,
      cartId: order.cartId ?? null,
      status: order.status,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      shippingFee: Number(order.shippingFee),
      tax: Number(order.tax),
      grandTotal: Number(order.grandTotal),
      currency: order.currency,
      paymentMethod: paidOrLatestPayment?.provider ?? null,
      acknowledgedAt: order.acknowledgedAt ?? null,
      acknowledgedById: order.acknowledgedById ?? null,
      installationRequired,
      shippingAddressId: order.shippingAddressId ?? null,
      shippingAddress: order.shippingAddress,
      ...(order.billingAddressId !== undefined && {
        billingAddressId: order.billingAddressId ?? null,
      }),
      ...(order.billingAddress !== undefined && {
        billingAddress: order.billingAddress,
      }),
      placedAt: order.placedAt ?? null,
      expiresAt: order.expiresAt ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: (order.items || []).map((item) => OrderMapper.toItemResponse(item, resolveThumbnail)),
      payments: order.payments?.map((payment) => PaymentMapper.toResponse(payment)),
      ...(order.invoice !== undefined && {
        invoice: OrderMapper.toInvoiceSummary(order.invoice),
      }),
    };
  }

  static toAdminListItem(order: any, resolveThumbnail?: ThumbnailResolver): AdminOrderListItemDto {
    const shippingAddr = order.shippingAddress as Record<string, any> | null;
    const customerName =
      order.user?.name ||
      (shippingAddr
        ? `${shippingAddr.firstName ?? ''} ${shippingAddr.lastName ?? ''}`.trim()
        : 'Customer');
    const customerEmail = order.user?.email || shippingAddr?.email || '';
    const customerPhone = order.user?.phone || shippingAddr?.phone || null;

    const firstItem = order.items?.[0] as OrderItemWithImages | undefined;
    const storageKey =
      firstItem?.variant?.images?.[0]?.storageKey ?? firstItem?.product?.images?.[0]?.storageKey;

    return {
      id: order.id,
      orderNumber: formatOrderNumber(order.id),
      status: order.status,
      paymentStatus: order.payments?.[0]?.status ?? null,
      paymentMethod: order.payments?.[0]?.provider ?? null,
      thumbnail: storageKey && resolveThumbnail ? resolveThumbnail(storageKey) : null,
      acknowledgedAt: order.acknowledgedAt ?? null,
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

  static toActivityResponse(activity: OrderActivityWithRelations): OrderActivityResponseDto {
    return {
      id: activity.id,
      orderId: activity.orderId,
      staffId: activity.staffId ?? null,
      staff: activity.staff
        ? {
            id: activity.staff.id,
            name: activity.staff.name,
            role: activity.staff.role,
          }
        : null,
      eventType: activity.eventType,
      description: activity.description,
      updateCategory: activity.updateCategory ?? null,
      isCustomerVisible: activity.isCustomerVisible,
      metadata: activity.metadata ?? null,
      notification: activity.notification
        ? {
            id: activity.notification.id,
            channel: activity.notification.channel,
            recipient: activity.notification.recipient,
            status: activity.notification.status,
            attempts: activity.notification.attempts,
            sentAt: activity.notification.sentAt ?? null,
            lastError: activity.notification.lastError ?? null,
            createdAt: activity.notification.createdAt,
          }
        : null,
      createdAt: activity.createdAt,
    };
  }
}
