export class ReviewEligibilityResponseDto {
  eligible!: boolean;
  orderId!: string;
  productId!: string;
  existingReviewId?: string | null;
}
