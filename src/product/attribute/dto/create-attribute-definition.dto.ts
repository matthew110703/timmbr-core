import { AttributeScope, AttributeType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAttributeDefinitionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEnum(AttributeType)
  @IsNotEmpty()
  type!: AttributeType;

  @IsEnum(AttributeScope)
  @IsNotEmpty()
  scope!: AttributeScope;

  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean = false;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string | null = null;

  @IsOptional()
  @IsUUID()
  productId?: string | null = null;
}
