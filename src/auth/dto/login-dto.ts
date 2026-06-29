import { IsEmail, IsNotEmpty, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { passwordRegex } from './sign-up-dto';

export class LoginPayloadDto {
  @Transform(({ value }) => (value as string)?.toLowerCase())
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @Matches(passwordRegex, {
    message:
      'Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character',
  })
  password!: string;
}

export class LoginResponseDto {
  accessToken!: string;
  refreshToken!: string;
  id!: string;
  name!: string;
  email!: string;
  emailVerified!: boolean;
}
