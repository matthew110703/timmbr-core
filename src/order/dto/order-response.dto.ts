import { OrderStatus, PaymentProvider, PaymentStatus } from '@prisma/client';
import { PaymentResponseDto } from '@/payment/dto/payment-response.dto';

export class OrderItemResponseDto {
  id!: string;
  orderId!: string;
  productId!: string | null;
  variantId!: string | null;
  name!: string;
  sku!: string;
  quantity!: number;
  unitPrice!: number;
  totalPrice!: number;
  hsnCode!: string | null;
  gstRate!: number;
  taxAmount!: number;
  metadata!: any;
  /** Variant (else product) primary image; null if none or the product is gone. */
  thumbnail!: string | null;
  createdAt!: Date;
}

export class OrderResponseDto {
  id!: string;
  userId!: string;
  cartId!: string | null;
  status!: OrderStatus;
  subtotal!: number;
  discount!: number;
  shippingFee!: number;
  tax!: number;
  grandTotal!: number;
  currency!: string;
  shippingAddressId!: string | null;
  shippingAddress!: any;
  placedAt!: Date | null;
  expiresAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
  items!: OrderItemResponseDto[];
  payments?: PaymentResponseDto[];
}

export class CreateOrderResponseDto {
  order!: OrderResponseDto;
  payment!: {
    id: string;
    provider: PaymentProvider;
    status: PaymentStatus;
    amount: number;
    currency: string;
    razorpayOrderId?: string;
    razorpayKeyId?: string;
  };
}

export class AdminOrderCustomerDto {
  id!: string;
  name!: string;
  email!: string;
  phone!: string | null;
}

export class AdminOrderListItemDto {
  id!: string;
  status!: OrderStatus;
  paymentStatus!: PaymentStatus | null;
  grandTotal!: number;
  currency!: string;
  itemsCount!: number;
  customer!: AdminOrderCustomerDto;
  placedAt!: Date | null;
  expiresAt!: Date | null;
  createdAt!: Date;
}
