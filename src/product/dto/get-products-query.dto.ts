import { PaginationDto } from '@/common/dto/pagination.dto';
import { ProductStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class GetProductsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ProductStatus, { message: 'Invalid product status' })
  status?: ProductStatus;

  @IsOptional()
  @IsUUID('4', { message: 'Category ID must be a valid UUID' })
  categoryId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Brand ID must be a valid UUID' })
  brandId?: string;

  @IsOptional()
  @IsString({ message: 'Search query must be a string' })
  search?: string;
}
