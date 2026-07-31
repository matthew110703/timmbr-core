import { CategoryStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, IsUUID, Length } from 'class-validator';
import type { UUID } from 'crypto';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  name?: string;

  @IsOptional()
  @IsUUID()
  parentId?: UUID | null;

  @IsOptional()
  @IsUrl()
  logoUrl?: string | null;

  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;

  @IsOptional()
  @IsString()
  @Length(10, 200)
  description?: string | null;
}
