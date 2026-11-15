import { ReviewMediaKind, ReviewModerationAction, ReviewStatus } from '@prisma/client';

export class ReviewMediaResponseDto {
  id!: string;
  kind!: ReviewMediaKind;
  url!: string;
  thumbnailUrl?: string | null;
  sortOrder!: number;
}

export class ReviewProductSummaryDto {
  id!: string;
  title!: string;
  slug!: string;
  thumbnailUrl!: string | null;
}

export class ReviewerSummaryDto {
  id!: string;
  name!: string;
}

export class PendingRevisionResponseDto {
  id!: string;
  rating!: number;
  title!: string | null;
  comment!: string | null;
  media!: ReviewMediaResponseDto[];
}

export class ReviewLastModerationDto {
  action!: ReviewModerationAction;
  reason!: string | null;
  createdAt!: Date;
}

export class ReviewResponseDto {
  id!: string;
  productId!: string;
  orderId!: string;
  /** Present on owner and admin responses; omitted on public product lists. */
  userId?: string;
  authorName!: string;
  rating!: number;
  title!: string | null;
  comment!: string | null;
  status!: ReviewStatus;
  helpfulCount!: number;
  verifiedPurchase!: boolean;
  votedByViewer?: boolean;
  pendingRevision!: PendingRevisionResponseDto | null;
  product?: ReviewProductSummaryDto;
  reviewer?: ReviewerSummaryDto;
  /** Owner and admin only: the latest moderation decision, with its reason. */
  lastModeration?: ReviewLastModerationDto;
  media!: ReviewMediaResponseDto[];
  createdAt!: Date;
  updatedAt!: Date;
}

export class ProductReviewSummaryResponseDto {
  ratingAvg!: number | null;
  ratingCount!: number;
  rating1Count!: number;
  rating2Count!: number;
  rating3Count!: number;
  rating4Count!: number;
  rating5Count!: number;
}
