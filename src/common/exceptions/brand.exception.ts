import { ConflictException, NotFoundException } from '@nestjs/common';

export class BrandNotFoundException extends NotFoundException {
  constructor() {
    super({ message: 'Brand Not Found', code: 'BRAND_NOT_FOUND' });
  }
}

export class BrandAlreadyExistsException extends ConflictException {
  constructor() {
    super({ message: 'A Brand with this name already exists.', code: 'BRAND_ALREADY_EXISTS' });
  }
}
