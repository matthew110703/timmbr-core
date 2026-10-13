import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

export class SearchSuggestQueryDto {
  /** What the shopper has typed so far. Words under 2 letters are ignored. */
  @IsString({ message: 'q must be a single value' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @MaxLength(100, { message: 'q must be at most 100 characters' })
  q!: string;
}
