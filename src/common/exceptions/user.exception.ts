import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';

export class UserNotFoundException extends NotFoundException {
  constructor() {
    super({ message: 'User not found.', code: 'USER_NOT_FOUND' });
  }
}

export class EmailAlreadyExistsException extends ConflictException {
  constructor() {
    super({ message: 'Email already exists.', code: 'EMAIL_ALREADY_EXISTS' });
  }
}

export class UserDeactivatedException extends UnauthorizedException {
  constructor() {
    super({ message: 'This account has been deactivated.', code: 'ACCOUNT_DEACTIVATED' });
  }
}
