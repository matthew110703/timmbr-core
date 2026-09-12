import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class OrderNotFoundException extends NotFoundException {
  constructor(message = 'Order not found.') {
    super({ message, code: 'ORDER_NOT_FOUND' });
  }
}

export class OrderIllegalStateTransitionException extends BadRequestException {
  constructor(fromStatus: string, toStatus: string) {
    super({
      message: `Illegal order status transition from ${fromStatus} to ${toStatus}.`,
      code: 'ILLEGAL_ORDER_STATUS_TRANSITION',
    });
  }
}

export class OrderInvalidItemException extends BadRequestException {
  constructor(message = 'Invalid item provided in order.') {
    super({ message, code: 'ORDER_INVALID_ITEM' });
  }
}

export class OrderVariantUnavailableException extends UnprocessableEntityException {
  constructor(sku: string, reason = 'Variant is not available for purchase.') {
    super({
      message: `Variant ${sku} is unavailable: ${reason}`,
      code: 'VARIANT_UNAVAILABLE',
    });
  }
}

export class OrderInsufficientStockException extends UnprocessableEntityException {
  constructor(sku: string, available: number, requested: number) {
    super({
      message: `Insufficient stock for variant ${sku}. Available: ${available}, Requested: ${requested}.`,
      code: 'INSUFFICIENT_STOCK',
    });
  }
}

export class OrderAccessForbiddenException extends ForbiddenException {
  constructor(message = 'You do not have permission to access this order.') {
    super({ message, code: 'ORDER_ACCESS_FORBIDDEN' });
  }
}
