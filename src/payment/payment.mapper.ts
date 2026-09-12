import { Payment } from '@prisma/client';
import { PaymentResponseDto } from './dto/payment-response.dto';

export class PaymentMapper {
  static toResponse(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
      orderId: payment.orderId,
      provider: payment.provider,
      providerOrderId: payment.providerOrderId ?? null,
      providerPaymentId: payment.providerPaymentId ?? null,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
