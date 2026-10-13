import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class CartNotFoundException extends NotFoundException {
  constructor(message = 'Cart not found.') {
    super({ message, code: 'CART_NOT_FOUND' });
  }
}

export class CartItemNotFoundException extends NotFoundException {
  constructor(message = 'Item not found in cart.') {
    super({ message, code: 'CART_ITEM_NOT_FOUND' });
  }
}

export class CartItemForbiddenException extends ForbiddenException {
  constructor(message = 'Item does not belong to your cart.') {
    super({ message, code: 'CART_ITEM_FORBIDDEN' });
  }
}

export class CartVariantUnavailableException extends UnprocessableEntityException {
  constructor(skuOrId: string, reason = 'Variant is not available for purchase.') {
    super({
      message: `Variant ${skuOrId} is unavailable: ${reason}`,
      code: 'VARIANT_UNAVAILABLE',
    });
  }
}

export class CartInvalidQuantityException extends BadRequestException {
  constructor(message = 'Quantity must be at least 1.') {
    super({ message, code: 'INVALID_QUANTITY' });
  }
}

/** The cart line would exceed the stock that's free to sell (quantity − reserved). */
export class CartItemOutOfStockException extends ConflictException {
  constructor(available: number) {
    super({
      message: available > 0 ? `Only ${available} left in stock.` : 'This item is out of stock.',
      code: 'CART_ITEM_OUT_OF_STOCK',
      details: { available },
    });
  }
}

/** The cart line would exceed the per-item limit. */
export class CartQuantityLimitException extends ConflictException {
  constructor(max: number) {
    super({
      message: `You can add up to ${max} of this item.`,
      code: 'CART_QUANTITY_LIMIT',
      details: { max },
    });
  }
}
