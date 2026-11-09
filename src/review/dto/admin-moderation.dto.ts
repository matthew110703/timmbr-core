import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminReviewModerationDto {
  @IsOptional()
  @IsString({ message: 'Reason must be a string.' })
  @MaxLength(500, { message: 'Reason must be at most 500 characters.' })
  reason?: string;
}
