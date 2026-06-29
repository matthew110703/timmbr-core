import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsBoolean,
  IsArray,
  IsUUID,
  IsDate,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { OAuthType } from '@prisma/client';

export const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export class SignUpPayloadDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(3, { message: 'Name must be at least 3 characters' })
  @MaxLength(64, { message: 'Name must be at most 64 characters' })
  name!: string;

  @Transform(({ value }) => (value as string)?.toLowerCase())
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @Matches(passwordRegex, {
    message:
      'Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character',
  })
  password!: string;
}

export class UserShortDto {
  @IsString()
  @IsUUID()
  id!: string;

  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsBoolean()
  emailVerified!: boolean;

  @IsArray()
  @IsOptional()
  linkedProviders!: OAuthType[];

  @Type(() => Date)
  @IsDate()
  createdAt!: Date;
}

export class SignUpResponseDto {
  user!: UserShortDto;
  accessToken!: string;
  refreshToken!: string;
}
