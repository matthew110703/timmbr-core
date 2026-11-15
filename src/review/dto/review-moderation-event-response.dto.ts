import { ReviewModerationAction } from '@prisma/client';
import { ReviewerSummaryDto } from './review-response.dto';

export class ReviewModerationEventResponseDto {
  id!: string;
  reviewId!: string;
  revisionId!: string | null;
  actorId!: string;
  actor!: ReviewerSummaryDto | null;
  action!: ReviewModerationAction;
  reason!: string | null;
  createdAt!: Date;
}
