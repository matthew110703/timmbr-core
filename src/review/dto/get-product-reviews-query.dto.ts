import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export enum ReviewPublicSortBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  HIGHEST_RATING = 'highest_rating',
  LOWEST_RATING = 'lowest_rating',
  MOST_HELPFUL = 'most_helpful',
}

export class GetProductReviewsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ReviewPublicSortBy, { message: 'Invalid sort value.' })
  sortBy?: ReviewPublicSortBy = ReviewPublicSortBy.NEWEST;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Star filter must be an integer.' })
  @Min(1, { message: 'Star filter must be between 1 and 5.' })
  @Max(5, { message: 'Star filter must be between 1 and 5.' })
  rating?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'hasImages must be a boolean.' })
  hasImages?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'hasVideos must be a boolean.' })
  hasVideos?: boolean;
}
