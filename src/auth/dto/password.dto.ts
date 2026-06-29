import { IsEmail, IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { passwordRegex } from './sign-up-dto';
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

  @Matches(passwordRegex, {
    message:
      'Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character',
  })
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

  @Matches(passwordRegex, {
    message:
      'Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character',
  })
  newPassword!: string;
}
