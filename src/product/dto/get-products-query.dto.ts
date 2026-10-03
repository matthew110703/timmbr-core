import { PaginationDto } from '@/common/dto/pagination.dto';
import { ToUuidArray } from '@/common/transformers/to-uuid-array.transformer';
import { ProductStatus } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class GetProductsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ProductStatus, { message: 'Invalid product status' })
  status?: ProductStatus;

  @IsOptional()
  @ToUuidArray()
  @IsArray({ message: 'productIds must be an array or comma-separated list' })
  @IsUUID('4', { each: true, message: 'Each product ID must be a valid UUID' })
  productIds?: string[];

  @IsOptional()
  @IsUUID('4', { message: 'Category ID must be a valid UUID' })
  categoryId?: string;

  @IsOptional()
  @ToUuidArray()
  @IsArray({ message: 'categoryIds must be an array or comma-separated list' })
  @IsUUID('4', { each: true, message: 'Each category ID must be a valid UUID' })
  categoryIds?: string[];

  @IsOptional()
  @IsUUID('4', { message: 'Brand ID must be a valid UUID' })
  brandId?: string;

  @IsOptional()
  @ToUuidArray()
  @IsArray({ message: 'brandIds must be an array or comma-separated list' })
  @IsUUID('4', { each: true, message: 'Each brand ID must be a valid UUID' })
  brandIds?: string[];

  @IsOptional()
  @IsString({ message: 'Search query must be a string' })
  search?: string;
}
