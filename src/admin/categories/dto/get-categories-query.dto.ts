import { PaginationDto } from '@/common/dto/pagination.dto';
import { CategoryStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class GetCategoriesQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
