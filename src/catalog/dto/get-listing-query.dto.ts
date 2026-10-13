import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { LISTING_PAGE_SIZES, LISTING_SORTS, MAX_LISTING_PAGE } from '../listing/listing.types';
import type { ListingSort } from '../listing/listing.types';
import { FILTERS_MAX_LENGTH } from '../listing/listing-filters';

const MAX_PRICE = 100_000_000;

export class GetListingQueryDto {
  /** Category slug; omitted for all products. */
  @IsOptional()
  @IsString({ message: 'category must be a single slug' })
  @MaxLength(120, { message: 'category must be at most 120 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'category is not a valid slug' })
  category?: string;

  /** Search text: every word must appear in the title or brand. Words under 2 letters are ignored. */
  @IsOptional()
  @IsString({ message: 'q must be a single value' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @MaxLength(100, { message: 'q must be at most 100 characters' })
  q?: string;

  /** e.g. "material:teak,walnut;size:king;brand:oakline". */
  @IsOptional()
  @IsString({ message: 'filters must be a single value: combine groups with ";"' })
  @MaxLength(FILTERS_MAX_LENGTH, {
    message: `filters must be at most ${FILTERS_MAX_LENGTH} characters`,
  })
  filters?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'priceMin must be a whole number' })
  @Min(0, { message: 'priceMin must be at least 0' })
  @Max(MAX_PRICE, { message: `priceMin must be at most ${MAX_PRICE}` })
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'priceMax must be a whole number' })
  @Min(0, { message: 'priceMax must be at least 0' })
  @Max(MAX_PRICE, { message: `priceMax must be at most ${MAX_PRICE}` })
  priceMax?: number;

  @IsOptional()
  @IsIn(LISTING_SORTS, { message: `sort must be one of: ${LISTING_SORTS.join(', ')}` })
  sort?: ListingSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be a whole number' })
  @Min(1, { message: 'page must be at least 1' })
  @Max(MAX_LISTING_PAGE, { message: `page must be at most ${MAX_LISTING_PAGE}` })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsIn(LISTING_PAGE_SIZES, { message: `limit must be one of: ${LISTING_PAGE_SIZES.join(', ')}` })
  limit?: number;
}
