import { formatOrderNumber } from '@/order/order.helper';
import { TransactionListItemDto } from './dto/transaction-response.dto';

export class TransactionMapper {
  static toListItem(payment: any): TransactionListItemDto {
    const order = payment.order;
    const shipping = (order?.shippingAddress ?? {}) as Record<string, any>;
    const user = order?.user;

    const customerName =
      user?.name ||
      [shipping.firstName, shipping.lastName].filter(Boolean).join(' ').trim() ||
      'Customer';
    const customerEmail = user?.email || shipping.email || '';
    const customerPhone = user?.phone || shipping.phone || null;

    return {
      id: payment.id,
      orderId: payment.orderId,
      orderNumber: formatOrderNumber(payment.orderId),
      orderStatus: order?.status,
      provider: payment.provider,
      providerOrderId: payment.providerOrderId ?? null,
      providerPaymentId: payment.providerPaymentId ?? null,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      customer: {
        id: user?.id ?? order?.userId ?? '',
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
      },
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
