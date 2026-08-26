import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MEDIA_CONSTANTS } from '@/media/common/media.constants';

export class CreateProductImageItemDto {
  @IsString({ message: 'Storage key must be a string' })
  @IsNotEmpty({ message: 'Storage key cannot be empty' })
  @MaxLength(255, { message: 'Storage key cannot exceed 255 characters' })
  storageKey!: string;

  @IsUUID('4', { message: 'Variant ID must be a valid UUID' })
  @IsOptional()
  variantId?: string;

  @IsString({ message: 'Alt text must be a string' })
  @MaxLength(255, { message: 'Alt text cannot exceed 255 characters' })
  @IsOptional()
  altText?: string;

  @IsInt({ message: 'Sort order must be an integer' })
  @Min(0, { message: 'Sort order cannot be negative' })
  @IsOptional()
  sortOrder?: number = 0;

  @IsBoolean({ message: 'isPrimary must be a boolean' })
  @IsOptional()
  isPrimary?: boolean = false;
}

export class CreateProductImagesDto {
  @IsArray({ message: 'Images must be an array' })
  @ArrayMinSize(1, { message: 'At least one image must be provided' })
  @ArrayMaxSize(MEDIA_CONSTANTS.MAX_BATCH_UPLOAD_LIMIT, {
    message: `Cannot register more than ${MEDIA_CONSTANTS.MAX_BATCH_UPLOAD_LIMIT} images at once`,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageItemDto)
  images!: CreateProductImageItemDto[];
}
