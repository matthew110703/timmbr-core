import { ReviewModerationAction } from '@prisma/client';

export class ReviewModerationEventResponseDto {
  id!: string;
  reviewId!: string;
  revisionId!: string | null;
  actorId!: string;
  action!: ReviewModerationAction;
  reason!: string | null;
  createdAt!: Date;
}
