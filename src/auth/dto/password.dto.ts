import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsStrongPassword } from './password-policy';
import { TokenType } from '../types/token-type.enum';

export class ForgotPasswordDto {
  @Transform(({ value }) => (value as string)?.toLowerCase())
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  token!: string;

  @IsStrongPassword()
  newPassword!: string;
}

export class ValidateTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  token!: string;

  @IsEnum(TokenType, { message: 'Type must be a valid token type' })
  type!: TokenType;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  oldPassword!: string;

  @IsStrongPassword()
  newPassword!: string;
}

/** Set a password after OTP verification (new account, or forgot-password). */
export class SetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  token!: string;

  @IsStrongPassword()
  password!: string;
}
