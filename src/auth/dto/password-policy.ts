import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength } from 'class-validator';

export const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character';

/** Max length guards argon2 against oversized input. */
const PASSWORD_MAX_LENGTH = 128;

/** Policy for passwords being *set* (never applied when checking a login). */
export function IsStrongPassword() {
  return applyDecorators(
    IsString(),
    MaxLength(PASSWORD_MAX_LENGTH),
    Matches(passwordRegex, { message: PASSWORD_POLICY_MESSAGE }),
  );
}
