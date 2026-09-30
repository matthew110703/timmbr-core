import { CartResponseDto } from './dto/cart-response.dto';
import { PriceSyncResult } from './cart.pricing-sync';
import { CART_CONSTANTS } from './cart.constants';

export class CartMapper {
  static toEmptyResponse(): CartResponseDto {
    return {
      id: null,
      items: [],
      subtotal: '0.00',
      grandTotal: '0.00',
      currency: CART_CONSTANTS.DEFAULT_CURRENCY,
    };
  }

  static toResponse(cartId: string | null, syncResult: PriceSyncResult): CartResponseDto {
    return {
      id: cartId,
      items: syncResult.items,
      subtotal: syncResult.subtotal,
      grandTotal: syncResult.grandTotal,
      currency: syncResult.currency,
    };
  }
}
