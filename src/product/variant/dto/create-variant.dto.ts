import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { VariantStatus } from '@prisma/client';
import { IsValidCurrencyCode } from '@/common/decorators/is-currency-code.decorator';
import { IsCompareAtPriceValid } from '@/common/decorators/is-compare-at-price-valid.decorator';

export class CreateVariantDto {
  @IsString({ message: 'SKU must be a string' })
  @MinLength(2, { message: 'SKU must be at least 2 characters' })
  @MaxLength(100, { message: 'SKU cannot exceed 100 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  sku!: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Price must be a valid number with up to 2 decimal places' },
  )
  @Min(0, { message: 'Price cannot be less than 0' })
  price!: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Compare at price must be a valid number with up to 2 decimal places' },
  )
  @Min(0, { message: 'Compare at price cannot be less than 0' })
  @IsCompareAtPriceValid({
    message: 'Compare at price must be greater than or equal to the price',
  })
  @IsOptional()
  compareAtPrice?: number;

  @IsString({ message: 'Currency must be a string' })
  @IsValidCurrencyCode({
    message: 'Currency must be a valid ISO 4217 currency code (e.g. INR, USD, EUR)',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  currency?: string;

  @IsEnum(VariantStatus, {
    message: `Status must be one of: ${Object.values(VariantStatus).join(', ')}`,
  })
  @IsOptional()
  status?: VariantStatus;

  @IsBoolean({ message: 'isDefault must be a boolean' })
  @IsOptional()
  isDefault?: boolean;
}
