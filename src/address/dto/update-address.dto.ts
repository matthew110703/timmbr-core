import { AddressType } from '@prisma/client';
import {
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
  ValidateIf,
} from 'class-validator';

export class UpdateAddressDto {
  @IsString({ message: 'First name must be a string' })
  @IsNotEmpty({ message: 'First name cannot be empty' })
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  @MaxLength(64, { message: 'First name must be at most 64 characters' })
  @IsOptional()
  fname?: string;

  @IsString({ message: 'Last name must be a string' })
  @IsNotEmpty({ message: 'Last name cannot be empty' })
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  @MaxLength(64, { message: 'Last name must be at most 64 characters' })
  @IsOptional()
  lname?: string;

  @Matches(/^\+91[6-9]\d{9}$/, {
    message: 'Phone must be a valid Indian mobile number (e.g. +919876543210)',
  })
  @IsOptional()
  phone?: string;

  @IsString({ message: 'Address line 1 must be a string' })
  @IsNotEmpty({ message: 'Address line 1 cannot be empty' })
  @MaxLength(128, { message: 'Address line 1 must be at most 128 characters' })
  @IsOptional()
  line1?: string;

  @IsString({ message: 'Address line 2 must be a string' })
  @MaxLength(128, { message: 'Address line 2 must be at most 128 characters' })
  @IsOptional()
  line2?: string | null;

  @IsString({ message: 'City must be a string' })
  @IsNotEmpty({ message: 'City cannot be empty' })
  @MaxLength(64, { message: 'City must be at most 64 characters' })
  @IsOptional()
  city?: string;

  @IsString({ message: 'State must be a string' })
  @IsNotEmpty({ message: 'State cannot be empty' })
  @MaxLength(64, { message: 'State must be at most 64 characters' })
  @IsOptional()
  state?: string;

  @Matches(/^\d{6}$/, { message: 'Postal code must be a valid 6-digit Indian PIN code' })
  @IsOptional()
  postalCode?: string;

  @IsString({ message: 'Country must be a string' })
  @IsNotEmpty({ message: 'Country cannot be empty' })
  @MaxLength(64, { message: 'Country must be at most 64 characters' })
  @IsOptional()
  country?: string;

  @ValidateIf((o: UpdateAddressDto) => o.latitude !== null)
  @IsNumber({}, { message: 'Latitude must be a number' })
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  @IsOptional()
  latitude?: number | null;

  @ValidateIf((o: UpdateAddressDto) => o.longitude !== null)
  @IsNumber({}, { message: 'Longitude must be a number' })
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  @IsOptional()
  longitude?: number | null;

  @IsEnum(AddressType, { message: 'Type must be SHIPPING, BILLING, or BOTH' })
  @IsOptional()
  type?: AddressType;

  @IsString({ message: 'Label must be a string' })
  @IsNotEmpty({ message: 'Label cannot be empty' })
  @MaxLength(64, { message: 'Label must be at most 64 characters' })
  @IsOptional()
  label?: string;
}
