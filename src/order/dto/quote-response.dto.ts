export class QuoteItemDto {
  variantId!: string;
  productId!: string;
  name!: string;
  sku!: string;
  quantity!: number;
  unitPrice!: number;
  totalPrice!: number;
  hsnCode!: string | null;
  gstRate!: number;
  taxAmount!: number;
}

export class QuoteResponseDto {
  items!: QuoteItemDto[];
  subtotal!: number;
  discount!: number;
  shippingFee!: number;
  tax!: number;
  grandTotal!: number;
  currency!: string;
  /** Largest total that can be paid online in one order (rupees). */
  paymentLimit!: number;
}
