import { BrandStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(10, 200)
  description?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsEnum(BrandStatus)
  status?: BrandStatus;
}
