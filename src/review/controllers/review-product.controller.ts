import { Controller, Get, Param, Query } from '@nestjs/common';
import { APP_ROUTES } from '@/app.routes';
import { Public, ResponseMessage } from '@/common/decorators';
import { ReviewService } from '../review.service';
import { GetProductReviewsQueryDto } from '../dto/get-product-reviews-query.dto';

@Controller(`${APP_ROUTES.PRODUCTS}/:productId/reviews`)
export class ReviewProductController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  @Public()
  @ResponseMessage('Product reviews fetched successfully.')
  list(@Param('productId') productId: string, @Query() query: GetProductReviewsQueryDto) {
    return this.reviewService.listPublicForProduct(productId, query);
  }

  @Get('summary')
  @Public()
  @ResponseMessage('Product review summary fetched successfully.')
  summary(@Param('productId') productId: string) {
    return this.reviewService.getProductSummary(productId);
  }
}
