import {
  InvoicePdfStatus,
  InvoiceStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
} from '@prisma/client';
import { PaymentResponseDto } from '@/payment/dto/payment-response.dto';

export class OrderInvoiceSummaryDto {
  id!: string;
  invoiceNumber!: string;
  status!: InvoiceStatus;
  pdfStatus!: InvoicePdfStatus;
  issuedAt!: Date;
}

export class OrderItemResponseDto {
  id!: string;
  orderId!: string;
  productId!: string | null;
  variantId!: string | null;
  name!: string;
  sku!: string;
  quantity!: number;
  originalUnitPrice?: number;
  unitPrice!: number;
  discountAmount?: number;
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
  billingAddressId?: string | null;
  billingAddress?: any;
  placedAt!: Date | null;
  expiresAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
  items!: OrderItemResponseDto[];
  payments?: PaymentResponseDto[];
  invoice?: OrderInvoiceSummaryDto | null;
}

/** What a client needs to open the Razorpay checkout for an order. Amount is in rupees. */
export class PaymentInitDto {
  id!: string;
  provider!: PaymentProvider;
  status!: PaymentStatus;
  amount!: number;
  currency!: string;
  razorpayOrderId?: string;
  razorpayKeyId?: string;
}

export class CreateOrderResponseDto {
  order!: OrderResponseDto;
  payment!: PaymentInitDto;
}

export class PaymentSessionResponseDto {
  orderId!: string;
  payment!: PaymentInitDto;
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
