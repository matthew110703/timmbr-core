import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { REVIEW_CONSTANTS } from '../review.constants';

export class CreateReviewDto {
  @IsUUID('4', { message: 'Order ID must be a valid UUID.' })
  orderId!: string;

  @IsUUID('4', { message: 'Product ID must be a valid UUID.' })
  productId!: string;

  @Type(() => Number)
  @IsInt({ message: 'Rating must be an integer.' })
  @Min(1, { message: 'Rating must be at least 1.' })
  @Max(5, { message: 'Rating must be at most 5.' })
  rating!: number;

  @IsOptional()
  @IsString({ message: 'Title must be a string.' })
  @MaxLength(REVIEW_CONSTANTS.TITLE_MAX_LENGTH, {
    message: `Title must be at most ${REVIEW_CONSTANTS.TITLE_MAX_LENGTH} characters.`,
  })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Comment must be a string.' })
  @MaxLength(REVIEW_CONSTANTS.COMMENT_MAX_LENGTH, {
    message: `Comment must be at most ${REVIEW_CONSTANTS.COMMENT_MAX_LENGTH} characters.`,
  })
  comment?: string;
}
