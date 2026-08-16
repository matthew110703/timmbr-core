import { ConflictException, NotFoundException } from '@nestjs/common';

export class ProductNotFoundException extends NotFoundException {
  constructor() {
    super({ message: 'Product Not Found', code: 'PRODUCT_NOT_FOUND' });
  }
}

export class ProductAlreadyExistsException extends ConflictException {
  constructor() {
    super({ message: 'A Product with this title already exists.', code: 'PRODUCT_ALREADY_EXISTS' });
  }
}
