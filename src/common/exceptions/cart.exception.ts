import {
  BadRequestException,
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
