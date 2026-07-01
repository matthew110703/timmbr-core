import { AddressType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAddressDto {
  @IsString({ message: 'First name must be a string' })
  @IsNotEmpty({ message: 'First name is required' })
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  @MaxLength(64, { message: 'First name must be at most 64 characters' })
  fname!: string;

  @IsString({ message: 'Last name must be a string' })
  @IsNotEmpty({ message: 'Last name is required' })
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  @MaxLength(64, { message: 'Last name must be at most 64 characters' })
  lname!: string;

  @Matches(/^\+91[6-9]\d{9}$/, {
    message: 'Phone must be a valid Indian mobile number (e.g. +919876543210)',
  })
  phone!: string;

  @IsString({ message: 'Address line 1 must be a string' })
  @IsNotEmpty({ message: 'Address line 1 is required' })
  @MaxLength(128, { message: 'Address line 1 must be at most 128 characters' })
  line1!: string;

  @IsString({ message: 'Address line 2 must be a string' })
  @IsOptional()
  @MaxLength(128, { message: 'Address line 2 must be at most 128 characters' })
  line2?: string;

  @IsString({ message: 'City must be a string' })
  @IsNotEmpty({ message: 'City is required' })
  @MaxLength(64, { message: 'City must be at most 64 characters' })
  city!: string;

  @IsString({ message: 'State must be a string' })
  @IsNotEmpty({ message: 'State is required' })
  @MaxLength(64, { message: 'State must be at most 64 characters' })
  state!: string;

  @Matches(/^\d{6}$/, { message: 'Postal code must be a valid 6-digit Indian PIN code' })
  postalCode!: string;

  @IsString({ message: 'Country must be a string' })
  @IsNotEmpty({ message: 'Country is required' })
  @MaxLength(64, { message: 'Country must be at most 64 characters' })
  country!: string;

  @IsBoolean({ message: 'isDefault must be a boolean' })
  @IsOptional()
  isDefault?: boolean;

  @IsNumber({}, { message: 'Latitude must be a number' })
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  @IsOptional()
  latitude?: number;

  @IsNumber({}, { message: 'Longitude must be a number' })
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  @IsOptional()
  longitude?: number;

  @IsEnum(AddressType, { message: 'Type must be SHIPPING, BILLING, or BOTH' })
  @IsOptional()
  type?: AddressType;

  @IsString({ message: 'Label must be a string' })
  @IsOptional()
  @MaxLength(64, { message: 'Label must be at most 64 characters' })
  label?: string;
}
