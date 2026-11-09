import { IsUUID } from 'class-validator';

export class GetReviewEligibilityQueryDto {
  @IsUUID('4', { message: 'Order ID must be a valid UUID.' })
  orderId!: string;

  @IsUUID('4', { message: 'Product ID must be a valid UUID.' })
  productId!: string;
}
