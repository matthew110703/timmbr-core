import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { SWATCH_HEX_PATTERN } from './create-attribute-option.dto';

/** The slug is immutable (storefront URLs use it); everything else can change. */
export class UpdateAttributeOptionDto {
  @IsOptional()
  @IsString({ message: 'Label must be a string' })
  @MaxLength(100, { message: 'Label must be at most 100 characters' })
  label?: string;

  @IsOptional()
  @ValidateIf((o: UpdateAttributeOptionDto) => o.swatchHex !== null)
  @Matches(SWATCH_HEX_PATTERN, { message: 'Swatch colour must be a hex value like #5C3A21' })
  swatchHex?: string | null;

  @IsOptional()
  @IsInt({ message: 'Sort order must be an integer' })
  @Min(0, { message: 'Sort order must be at least 0' })
  @Max(10000, { message: 'Sort order must be at most 10000' })
  sortOrder?: number;
}
