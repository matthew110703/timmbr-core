import { CartItemResponseDto } from './cart-item-response.dto';

export class CartResponseDto {
  id!: string | null;
  items!: CartItemResponseDto[];
  subtotal!: string;
  grandTotal!: string;
  currency!: string;
}
