import { OrderStatus, PaymentProvider, PaymentStatus } from '@prisma/client';

export class TransactionCustomerDto {
  id!: string;
  name!: string;
  email!: string;
  phone!: string | null;
}

export class TransactionListItemDto {
  id!: string;
  orderId!: string;
  orderNumber!: string;
  orderStatus!: OrderStatus;
  provider!: PaymentProvider;
  providerOrderId!: string | null;
  providerPaymentId!: string | null;
  amount!: number;
  currency!: string;
  status!: PaymentStatus;
  customer!: TransactionCustomerDto;
  createdAt!: Date;
  updatedAt!: Date;
}
