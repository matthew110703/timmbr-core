import {
  BadRequestException,
  ConflictException,
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

export class OrderNotPayableException extends ConflictException {
  constructor(message = 'This order can no longer be paid for. Please place a new order.') {
    super({ message, code: 'ORDER_NOT_PAYABLE' });
  }
}

export class OrderCancellationRestrictedException extends ConflictException {
  constructor(
    message = 'Direct cancellation is unavailable after manufacturing has started. Submit a cancellation request for manager approval.',
  ) {
    super({ message, code: 'ORDER_CANCELLATION_RESTRICTED' });
  }
}

export class OrderCancellationApprovalNotFoundException extends NotFoundException {
  constructor(message = 'No pending cancellation approval request was found for this order.') {
    super({ message, code: 'CANCELLATION_REQUEST_NOT_FOUND' });
  }
}

export class OrderInvalidActivityStateException extends BadRequestException {
  constructor(message = 'Invalid order activity state.') {
    super({ message, code: 'INVALID_ORDER_ACTIVITY_STATE' });
  }
}
