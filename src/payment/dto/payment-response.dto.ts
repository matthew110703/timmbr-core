import { PaymentProvider, PaymentStatus } from '@prisma/client';

export class PaymentResponseDto {
  id!: string;
  orderId!: string;
  provider!: PaymentProvider;
  providerOrderId!: string | null;
  providerPaymentId!: string | null;
  amount!: number;
  currency!: string;
  status!: PaymentStatus;
  createdAt!: Date;
  updatedAt!: Date;
}
