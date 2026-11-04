import { PaginationDto } from '@/common/dto/pagination.dto';
import { IsOptional, IsUUID } from 'class-validator';

export class GetProductImagesQueryDto extends PaginationDto {
  @IsUUID('4', { message: 'Variant ID must be a valid UUID' })
  @IsOptional()
  variantId?: string;
}
