import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Auth errors with stable `code`s the frontends map to copy. 429s carry
 * `details.retryAfter` (seconds); the global filter also sets `Retry-After`.
 */

class TooManyRequestsException extends HttpException {
  constructor(code: string, message: string, retryAfter: number) {
    super({ code, message, details: { retryAfter } }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/** Per-IP request limit (AppThrottlerGuard). */
export class RateLimitedException extends TooManyRequestsException {
  constructor(retryAfter: number) {
    super('RATE_LIMITED', `Too many requests. Please try again in ${retryAfter}s.`, retryAfter);
  }
}

export class InvalidIdentifierException extends BadRequestException {
  constructor() {
    super({
      code: 'INVALID_IDENTIFIER',
      message: 'Please provide a valid email address or phone number.',
    });
  }
}

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super({ code: 'INVALID_CREDENTIALS', message: 'Incorrect email/phone or password.' });
  }
}

export class EmailNotVerifiedException extends ForbiddenException {
  constructor() {
    super({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please sign in with a one-time code to verify your email first.',
    });
  }
}

export class OtpInvalidException extends UnauthorizedException {
  constructor(attemptsLeft: number) {
    super({
      code: 'OTP_INVALID',
      message: 'Incorrect verification code.',
      details: { attemptsLeft },
    });
  }
}

export class OtpExpiredException extends UnauthorizedException {
  constructor() {
    super({
      code: 'OTP_EXPIRED',
      message: 'This code has expired. Please request a new one.',
    });
  }
}

export class OtpLockedException extends TooManyRequestsException {
  constructor(retryAfter: number) {
    super('OTP_LOCKED', 'Too many incorrect attempts. Please request a new code.', retryAfter);
  }
}

export class OtpCooldownException extends TooManyRequestsException {
  constructor(retryAfter: number) {
    super('OTP_COOLDOWN', `Please wait ${retryAfter}s before requesting another code.`, retryAfter);
  }
}

export class OtpRateLimitedException extends TooManyRequestsException {
  constructor(retryAfter: number) {
    super('OTP_RATE_LIMITED', 'Too many codes requested. Please try again later.', retryAfter);
  }
}

export class PhoneLoginUnavailableException extends BadRequestException {
  constructor() {
    super({
      code: 'PHONE_LOGIN_UNAVAILABLE',
      message: 'Sign-in with a phone number is not available yet. Please use your email.',
    });
  }
}

export class PasswordSetupTokenInvalidException extends UnauthorizedException {
  constructor() {
    super({
      code: 'PASSWORD_SETUP_TOKEN_INVALID',
      message: 'This link has expired. Please sign in again to set your password.',
    });
  }
}

export class OtpNotAllowedForAdminException extends ForbiddenException {
  constructor() {
    super({
      code: 'OTP_NOT_ALLOWED',
      message: 'Admin Console accounts must sign in with their password.',
    });
  }
}

export class OAuthNotAllowedForAdminException extends ForbiddenException {
  constructor() {
    super({
      code: 'OAUTH_NOT_ALLOWED',
      message: 'Admin Console accounts must sign in with their password.',
    });
  }
}

export class OAuthStateInvalidException extends UnauthorizedException {
  constructor() {
    super({ code: 'OAUTH_STATE_INVALID', message: 'Sign-in session expired. Please try again.' });
  }
}
