import { ProductStatus } from '@prisma/client';
import {
  IsEnum,
  IsJSON,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateProductDto {
  @IsString({ message: 'Title must be a string' })
  @MinLength(2, { message: 'Title must be at least 2 characters' })
  @MaxLength(100, { message: 'Title cannot exceed 100 characters' })
  @IsOptional()
  title?: string;

  @IsString({ message: 'Description must be a string' })
  @IsJSON({ message: 'Description must be valid stringified JSON' })
  @IsOptional()
  description?: string;

  @IsString({ message: 'Short description must be a string' })
  @MinLength(2, { message: 'Short description must be at least 2 characters' })
  @MaxLength(250, { message: 'Short description cannot exceed 250 characters' })
  @IsOptional()
  shortDescription?: string;

  @IsEnum(ProductStatus, { message: 'Invalid product status' })
  @IsOptional()
  status?: ProductStatus;

  @IsOptional()
  @Matches(/^(?!0+$)(\d{4}|\d{6}|\d{8})$/, {
    message: 'HSN code must be 4, 6, or 8 digits',
  })
  hsnCode?: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'GST rate must be a valid number with up to 2 decimal places' },
  )
  @Min(0, { message: 'GST rate cannot be less than 0' })
  @Max(100, { message: 'GST rate cannot exceed 100' })
  @IsOptional()
  gstRate?: number;

  @IsUUID('4', { message: 'Brand ID must be a valid UUID' })
  @IsOptional()
  brandId?: string;

  @IsUUID('4', { message: 'Category ID must be a valid UUID' })
  @IsOptional()
  categoryId?: string;
}
