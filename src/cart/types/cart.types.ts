export interface RedisCartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  metaData?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface RedisCart {
  id: string;
  status: 'ACTIVE' | 'CONVERTED' | 'ABANDONED';
  subtotal: string;
  grandTotal: string;
  currency: string;
  items: RedisCartItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CartContext {
  userId: string | null;
  guestCartId: string | null;
}
