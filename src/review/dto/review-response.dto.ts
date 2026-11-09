import { ReviewMediaKind, ReviewStatus } from '@prisma/client';

export class ReviewMediaResponseDto {
  id!: string;
  kind!: ReviewMediaKind;
  url!: string;
  thumbnailUrl?: string | null;
  sortOrder!: number;
}

export class ReviewResponseDto {
  id!: string;
  productId!: string;
  orderId!: string;
  userId!: string;
  rating!: number;
  title!: string | null;
  comment!: string | null;
  status!: ReviewStatus;
  helpfulCount!: number;
  verifiedPurchase!: boolean;
  hasPendingRevision!: boolean;
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
