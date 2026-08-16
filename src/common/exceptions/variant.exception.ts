import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

export class VariantNotFoundException extends NotFoundException {
  constructor() {
    super({ message: 'Variant Not Found', code: 'VARIANT_NOT_FOUND' });
  }
}

export class VariantAlreadyExistsException extends ConflictException {
  constructor() {
    super({
      message: 'A Variant with this SKU already exists.',
      code: 'VARIANT_ALREADY_EXISTS',
    });
  }
}

export class VariantInvalidPriceException extends BadRequestException {
  constructor(message = 'Compare at price must be greater than or equal to the price.') {
    super({
      message,
      code: 'VARIANT_INVALID_PRICE',
    });
  }
}
