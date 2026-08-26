import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

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

export class ProductImageNotFoundException extends NotFoundException {
  constructor() {
    super({ message: 'Product Image Not Found', code: 'PRODUCT_IMAGE_NOT_FOUND' });
  }
}

export class ProductImageInvalidVariantException extends BadRequestException {
  constructor() {
    super({
      message: 'Specified variant does not belong to this product',
      code: 'PRODUCT_IMAGE_INVALID_VARIANT',
    });
  }
}

export class ProductImageInvalidStorageKeyException extends BadRequestException {
  constructor(storageKey: string) {
    super({
      message: `Invalid storage key: '${storageKey}'. Storage key must start with products/{productId}/images/`,
      code: 'PRODUCT_IMAGE_INVALID_STORAGE_KEY',
    });
  }
}

export class ProductImageObjectNotFoundInStorageException extends BadRequestException {
  constructor(storageKey: string) {
    super({
      message: `Media object for key '${storageKey}' was not found in storage. Please upload the file to the presigned URL first.`,
      code: 'PRODUCT_IMAGE_OBJECT_NOT_FOUND',
    });
  }
}
