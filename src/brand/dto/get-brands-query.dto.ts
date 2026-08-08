import { PaginationDto } from '@/common/dto/pagination.dto';
import { BrandStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class GetBrandsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(BrandStatus)
  status?: BrandStatus;
}
