export class CartItemResponseDto {
  id!: string;
  cartId!: string;
  productId!: string;
  variantId!: string;
  name!: string;
  sku!: string;
  quantity!: number;
  unitPrice!: string;
  totalPrice!: string;
  currency!: string;
  thumbnail!: string | null;
  attributes?: Record<string, string>;
  isAvailable!: boolean;
  availableQuantity!: number;
  metaData?: Record<string, unknown> | null;
}
