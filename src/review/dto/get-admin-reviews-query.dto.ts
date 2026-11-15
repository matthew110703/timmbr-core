import { ReviewStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export enum AdminReviewSortBy {
  CREATED_AT = 'createdAt',
  RATING = 'rating',
}

const toBoolean = ({ value }: { value: unknown }) => value === 'true' || value === true;

export class GetAdminReviewsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ReviewStatus, { message: 'Invalid review status.' })
  status?: ReviewStatus;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'hasPendingRevision must be a boolean.' })
  hasPendingRevision?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'hasMedia must be a boolean.' })
  hasMedia?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Star filter must be an integer.' })
  @Min(1, { message: 'Star filter must be between 1 and 5.' })
  @Max(5, { message: 'Star filter must be between 1 and 5.' })
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(AdminReviewSortBy, { message: 'sortBy must be createdAt or rating.' })
  sortBy?: AdminReviewSortBy;

  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'order must be asc or desc.' })
  order?: 'asc' | 'desc';
}

export class AdminReviewCountsResponseDto {
  PENDING!: number;
  PUBLISHED!: number;
  HIDDEN!: number;
  REJECTED!: number;
  total!: number;
}
