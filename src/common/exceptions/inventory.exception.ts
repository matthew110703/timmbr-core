import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class InventoryNotFoundException extends NotFoundException {
  constructor(message = 'Inventory not found.') {
    super({ message, code: 'INVENTORY_NOT_FOUND' });
  }
}

export class InvalidInventoryQuantityException extends BadRequestException {
  constructor(message = 'Quantity cannot be less than reserved quantity or negative.') {
    super({ message, code: 'INVALID_INVENTORY_QUANTITY' });
  }
}

export class InsufficientStockException extends UnprocessableEntityException {
  constructor(message = 'Insufficient available stock for this adjustment.') {
    super({ message, code: 'INSUFFICIENT_STOCK' });
  }
}
