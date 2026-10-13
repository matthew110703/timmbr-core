export class CartCountLineDto {
  variantId!: string;
  quantity!: number;
}

/** GET /cart/count: units in the cart, and which variants they are. */
export class CartCountResponse {
  count!: number;
  items!: CartCountLineDto[];
}
