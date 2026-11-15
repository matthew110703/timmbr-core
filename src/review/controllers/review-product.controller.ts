import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { APP_ROUTES } from '@/app.routes';
import { OptionalAuth, Public, ResponseMessage } from '@/common/decorators';
import { JwtPayload } from '@/auth/types/jwt.types';
import { ReviewService } from '../review.service';
import { GetProductReviewsQueryDto } from '../dto/get-product-reviews-query.dto';

@Controller(`${APP_ROUTES.PRODUCTS}/:productId/reviews`)
export class ReviewProductController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  @OptionalAuth()
  @ResponseMessage('Product reviews fetched successfully.')
  list(
    @Req() req: FastifyRequest,
    @Param('productId') productId: string,
    @Query() query: GetProductReviewsQueryDto,
  ) {
    const user = req.user as JwtPayload | undefined;
    return this.reviewService.listPublicForProduct(productId, query, user?.sub);
  }

  @Get('summary')
  @Public()
  @ResponseMessage('Product review summary fetched successfully.')
  summary(@Param('productId') productId: string) {
    return this.reviewService.getProductSummary(productId);
  }
}
