import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FILTER_SLUG_PATTERN } from '../attribute.constants';

export const SWATCH_HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export class CreateAttributeOptionDto {
  @IsString({ message: 'Label must be a string' })
  @IsNotEmpty({ message: 'Label is required' })
  @MaxLength(100, { message: 'Label must be at most 100 characters' })
  label!: string;

  /** URL value; derived from the label when omitted. Immutable once set. */
  @IsOptional()
  @IsString({ message: 'Slug must be a string' })
  @MaxLength(60, { message: 'Slug must be at most 60 characters' })
  @Matches(FILTER_SLUG_PATTERN, {
    message: 'Slug must be lowercase letters, digits and single hyphens (e.g. "frosty-white")',
  })
  slug?: string;

  @IsOptional()
  @Matches(SWATCH_HEX_PATTERN, { message: 'Swatch colour must be a hex value like #5C3A21' })
  swatchHex?: string;

  @IsOptional()
  @IsInt({ message: 'Sort order must be an integer' })
  @Min(0, { message: 'Sort order must be at least 0' })
  @Max(10000, { message: 'Sort order must be at most 10000' })
  sortOrder?: number;
}
