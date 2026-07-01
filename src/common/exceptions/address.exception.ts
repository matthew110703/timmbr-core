import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class AddressNotFoundException extends NotFoundException {
  constructor() {
    super({ message: 'Address not found.', code: 'ADDRESS_NOT_FOUND' });
  }
}

export class AddressForbiddenException extends ForbiddenException {
  constructor() {
    super({
      message: 'This address belongs to another user.',
      code: 'ADDRESS_BELONGS_TO_ANOTHER_USER',
    });
  }
}

export class AddressAlreadyDefaultException extends ConflictException {
  constructor() {
    super({ message: 'This address is already the default.', code: 'ADDRESS_ALREADY_DEFAULT' });
  }
}

export class AddressLimitReachedException extends UnprocessableEntityException {
  constructor() {
    super({
      message: 'Address limit reached. Maximum 10 addresses allowed.',
      code: 'ADDRESS_LIMIT_REACHED',
    });
  }
}
