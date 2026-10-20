import { AttributeScope, AttributeType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export type AttributeSortField = 'createdAt' | 'name' | 'filterOrder';
export type SortOrder = 'asc' | 'desc';

export class GetAttributeDefinitionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(AttributeScope)
  scope?: AttributeScope;

  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isFilterable?: boolean;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsEnum(['createdAt', 'name', 'filterOrder'], {
    message: 'sortBy must be createdAt, name, or filterOrder',
  })
  sortBy?: AttributeSortField = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'sortOrder must be asc or desc' })
  sortOrder?: SortOrder = 'desc';
}
