import { PaginationDto } from '@/common/dto/pagination.dto';
import { ToUuidArray } from '@/common/transformers/to-uuid-array.transformer';
import { CategoryStatus } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class GetCategoriesQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;

  @IsOptional()
  @ToUuidArray()
  @IsArray({ message: 'categoryIds must be an array or comma-separated list' })
  @IsUUID('4', { each: true, message: 'Each category ID must be a valid UUID' })
  categoryIds?: string[];

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Parent ID must be a valid UUID' })
  parentId?: string;
}
