import { PaginationDto } from '@/common/dto/pagination.dto';
import { VariantStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class GetVariantsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(VariantStatus, { message: 'Invalid variant status' })
  status?: VariantStatus;

  @IsOptional()
  @IsBoolean({ message: 'isDefault must be a boolean' })
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  isDefault?: boolean;
}
