import { AttributeScope, AttributeType, FilterDisplay } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FILTER_SLUG_PATTERN } from '../attribute.constants';

export class UpdateAttributeDefinitionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string | null;

  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType;

  @IsOptional()
  @IsEnum(AttributeScope)
  scope?: AttributeScope;

  /** URL key for a filterable global attribute (e.g. "material"). Immutable once set. */
  @IsOptional()
  @IsString({ message: 'Key must be a string' })
  @MaxLength(40, { message: 'Key must be at most 40 characters' })
  @Matches(FILTER_SLUG_PATTERN, {
    message: 'Key must be lowercase letters, digits and single hyphens (e.g. "storage-type")',
  })
  key?: string;

  @IsOptional()
  @IsEnum(FilterDisplay, { message: 'Invalid filter display type' })
  displayType?: FilterDisplay;

  @IsOptional()
  @IsInt({ message: 'Filter order must be an integer' })
  @Min(0, { message: 'Filter order must be at least 0' })
  @Max(1000, { message: 'Filter order must be at most 1000' })
  filterOrder?: number;
}
