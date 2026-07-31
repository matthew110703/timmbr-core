import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

export class CategoryNotFoundException extends NotFoundException {
  constructor() {
    super({ message: 'Category Not Found', code: 'CATEGORY_NOT_FOUND' });
  }
}

export class CategoryAlreadyExistsException extends ConflictException {
  constructor(isParentId?: boolean) {
    const message = isParentId
      ? 'A Category with this name already exists under the selected parent.'
      : 'Category Already Exists.';
    super({ message: message, code: 'CATEGORY_ALREADY_EXISTS' });
  }
}

export class CategorySelfReferentialException extends BadRequestException {
  constructor() {
    super({
      message: 'Parent category cannot be the same as the category itself',
      code: 'CATEGORY_SELF_REFERENTIAL',
    });
  }
}
