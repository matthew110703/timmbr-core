import { IsOptional, IsUUID } from 'class-validator';

export class GetReviewEligibilityQueryDto {
  @IsUUID('4', { message: 'Product ID must be a valid UUID.' })
  productId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'Order ID must be a valid UUID.' })
  orderId?: string;
}
