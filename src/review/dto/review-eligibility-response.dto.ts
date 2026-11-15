export class ReviewEligibilityOrderOptionDto {
  orderId!: string;
  placedAt!: Date;
  existingReviewId!: string | null;
}

export class ReviewEligibilityResponseDto {
  eligible!: boolean;
  productId!: string;
  orderId?: string;
  existingReviewId?: string | null;
  /** Delivered purchases eligible for review when only `productId` was requested. */
  orders?: ReviewEligibilityOrderOptionDto[];
}
