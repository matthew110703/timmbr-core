import { UnauthorizedException } from '@nestjs/common';

export class TokenException extends UnauthorizedException {
  constructor(tokenCode: string, message: string) {
    super({ message, code: tokenCode });
  }
}

export class TokenInvalidException extends TokenException {
  constructor() {
    super('TOKEN_INVALID', 'Token is invalid or malformed.');
  }
}

export class TokenExpiredException extends TokenException {
  constructor() {
    super('TOKEN_EXPIRED', 'Refresh token has expired.');
  }
}

export class TokenRevokedException extends TokenException {
  constructor() {
    super('TOKEN_REVOKED', 'Token has been revoked or already used.');
  }
}
