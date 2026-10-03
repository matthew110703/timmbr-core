import { PaginationDto } from '@/common/dto/pagination.dto';
import { ToUuidArray } from '@/common/transformers/to-uuid-array.transformer';
import { BrandStatus } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class GetBrandsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(BrandStatus)
  status?: BrandStatus;

  @IsOptional()
  @ToUuidArray()
  @IsArray({ message: 'brandIds must be an array or comma-separated list' })
  @IsUUID('4', { each: true, message: 'Each brand ID must be a valid UUID' })
  brandIds?: string[];

  @IsOptional()
  @IsString()
  search?: string;
}
