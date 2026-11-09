import { ReviewStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class GetAdminReviewsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ReviewStatus, { message: 'Invalid review status.' })
  status?: ReviewStatus;
}
