import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { UserRole } from '@prisma/client';
import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage, Roles } from '@/common/decorators';
import { JwtPayload } from '@/auth/types/jwt.types';
import { ReviewService } from '../review.service';
import { GetAdminReviewsQueryDto } from '../dto/get-admin-reviews-query.dto';
import { AdminReviewModerationDto } from '../dto/admin-moderation.dto';
import { REVIEW_ROUTES } from '../review.routes';

@Controller(`${APP_ROUTES.PREFIX.ADMIN}/reviews`)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class ReviewAdminController {
  constructor(private readonly reviewService: ReviewService) {}

  private user(req: FastifyRequest) {
    return req.user as unknown as JwtPayload;
  }

  @Get()
  @ResponseMessage('Reviews fetched successfully.')
  list(@Query() query: GetAdminReviewsQueryDto) {
    return this.reviewService.listAdmin(query);
  }

  @Get(REVIEW_ROUTES.ADMIN_BY_ID)
  @ResponseMessage('Review fetched successfully.')
  getOne(@Param('reviewId') reviewId: string) {
    return this.reviewService.getAdminById(reviewId);
  }

  @Post(REVIEW_ROUTES.ADMIN_APPROVE)
  @HttpCode(200)
  @ResponseMessage('Review approved successfully.')
  approve(
    @Req() req: FastifyRequest,
    @Param('reviewId') reviewId: string,
    @Body() dto: AdminReviewModerationDto,
  ) {
    return this.reviewService.approveReview(this.user(req).sub, reviewId, dto);
  }

  @Post(REVIEW_ROUTES.ADMIN_REJECT)
  @HttpCode(200)
  @ResponseMessage('Review rejected successfully.')
  reject(
    @Req() req: FastifyRequest,
    @Param('reviewId') reviewId: string,
    @Body() dto: AdminReviewModerationDto,
  ) {
    return this.reviewService.rejectReview(this.user(req).sub, reviewId, dto);
  }

  @Post(REVIEW_ROUTES.ADMIN_HIDE)
  @HttpCode(200)
  @ResponseMessage('Review hidden successfully.')
  hide(
    @Req() req: FastifyRequest,
    @Param('reviewId') reviewId: string,
    @Body() dto: AdminReviewModerationDto,
  ) {
    return this.reviewService.hideReview(this.user(req).sub, reviewId, dto);
  }

  @Post(REVIEW_ROUTES.ADMIN_RESTORE)
  @HttpCode(200)
  @ResponseMessage('Review restored successfully.')
  restore(
    @Req() req: FastifyRequest,
    @Param('reviewId') reviewId: string,
    @Body() dto: AdminReviewModerationDto,
  ) {
    return this.reviewService.restoreReview(this.user(req).sub, reviewId, dto);
  }

  @Post(REVIEW_ROUTES.ADMIN_REVISION_APPROVE)
  @HttpCode(200)
  @ResponseMessage('Review revision approved successfully.')
  approveRevision(
    @Req() req: FastifyRequest,
    @Param('reviewId') reviewId: string,
    @Param('revisionId') revisionId: string,
    @Body() dto: AdminReviewModerationDto,
  ) {
    return this.reviewService.approveRevision(this.user(req).sub, reviewId, revisionId, dto);
  }

  @Post(REVIEW_ROUTES.ADMIN_REVISION_REJECT)
  @HttpCode(200)
  @ResponseMessage('Review revision rejected successfully.')
  rejectRevision(
    @Req() req: FastifyRequest,
    @Param('reviewId') reviewId: string,
    @Param('revisionId') revisionId: string,
    @Body() dto: AdminReviewModerationDto,
  ) {
    return this.reviewService.rejectRevision(this.user(req).sub, reviewId, revisionId, dto);
  }

  @Get(REVIEW_ROUTES.ADMIN_MODERATION_HISTORY)
  @ResponseMessage('Review moderation history fetched successfully.')
  history(@Param('reviewId') reviewId: string) {
    return this.reviewService.getModerationHistory(reviewId);
  }
}
