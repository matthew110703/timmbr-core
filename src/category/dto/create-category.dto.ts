import { CategoryStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, IsUUID, Length } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @Length(2, 50)
  name: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @Length(10, 200)
  description?: string;

  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus = CategoryStatus.ACTIVE;
}
