import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { ResponseMessage, Roles } from '@/common/decorators';
import { JwtPayload } from '@/auth/types/jwt.types';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { ReviewService } from '../review.service';
import { ReviewMediaService } from '../review-media.service';
import { CreateReviewDto } from '../dto/create-review.dto';
import { UpdateReviewDto } from '../dto/update-review.dto';
import { GetReviewEligibilityQueryDto } from '../dto/get-eligibility-query.dto';
import { REVIEW_ROUTES } from '../review.routes';
import { REVIEW_VOTE_THROTTLE, REVIEW_WRITE_THROTTLE } from '../review.constants';
import { PresignReviewMediaDto } from '../dto/presign-review-media.dto';
import { RegisterReviewMediaDto, ReorderReviewMediaDto } from '../dto/register-review-media.dto';

@Controller('reviews')
export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly reviewMediaService: ReviewMediaService,
  ) {}

  private user(req: FastifyRequest) {
    return req.user as unknown as JwtPayload;
  }

  @Get('eligibility')
  @Roles(UserRole.USER)
  @ResponseMessage('Review eligibility checked successfully.')
  eligibility(@Req() req: FastifyRequest, @Query() query: GetReviewEligibilityQueryDto) {
    const { sub } = this.user(req);
    return this.reviewService.getEligibility(sub, query.orderId, query.productId);
  }

  @Get('me')
  @Roles(UserRole.USER)
  @ResponseMessage('Your reviews fetched successfully.')
  listMine(@Req() req: FastifyRequest, @Query() query: PaginationDto) {
    const { sub } = this.user(req);
    return this.reviewService.listMine(sub, query.page, query.limit);
  }

  @Post()
  @Roles(UserRole.USER)
  @HttpCode(201)
  @Throttle(REVIEW_WRITE_THROTTLE)
  @ResponseMessage('Review created successfully.')
  create(@Req() req: FastifyRequest, @Body() dto: CreateReviewDto) {
    const { sub } = this.user(req);
    return this.reviewService.create(sub, dto);
  }

  @Get(REVIEW_ROUTES.BY_ID)
  @Roles(UserRole.USER)
  @ResponseMessage('Review fetched successfully.')
  getOne(@Req() req: FastifyRequest, @Param('reviewId') reviewId: string) {
    const { sub } = this.user(req);
    return this.reviewService.getOneForOwner(sub, reviewId);
  }

  @Patch(REVIEW_ROUTES.BY_ID)
  @Roles(UserRole.USER)
  @Throttle(REVIEW_WRITE_THROTTLE)
  @ResponseMessage('Review updated successfully.')
  update(
    @Req() req: FastifyRequest,
    @Param('reviewId') reviewId: string,
    @Body() dto: UpdateReviewDto,
  ) {
    const { sub } = this.user(req);
    return this.reviewService.update(sub, reviewId, dto);
  }

  @Post(REVIEW_ROUTES.HELPFUL)
  @Roles(UserRole.USER)
  @HttpCode(200)
  @Throttle(REVIEW_VOTE_THROTTLE)
  @ResponseMessage('Helpful vote recorded successfully.')
  addHelpful(@Req() req: FastifyRequest, @Param('reviewId') reviewId: string) {
    const { sub } = this.user(req);
    return this.reviewService.addHelpfulVote(sub, reviewId);
  }

  @Delete(REVIEW_ROUTES.HELPFUL)
  @Roles(UserRole.USER)
  @ResponseMessage('Helpful vote removed successfully.')
  removeHelpful(@Req() req: FastifyRequest, @Param('reviewId') reviewId: string) {
    const { sub } = this.user(req);
    return this.reviewService.removeHelpfulVote(sub, reviewId);
  }

  @Post(REVIEW_ROUTES.MEDIA_PRESIGN)
  @Roles(UserRole.USER)
  @HttpCode(200)
  @Throttle(REVIEW_WRITE_THROTTLE)
  @ResponseMessage('Review media upload URLs generated successfully.')
  presignMedia(
    @Req() req: FastifyRequest,
    @Param('reviewId') reviewId: string,
    @Body() dto: PresignReviewMediaDto,
  ) {
    const { sub } = this.user(req);
    return this.reviewMediaService.presign(sub, reviewId, dto);
  }

  @Post(REVIEW_ROUTES.MEDIA)
  @Roles(UserRole.USER)
  @HttpCode(201)
  @Throttle(REVIEW_WRITE_THROTTLE)
  @ResponseMessage('Review media registered successfully.')
  registerMedia(
    @Req() req: FastifyRequest,
    @Param('reviewId') reviewId: string,
    @Body() dto: RegisterReviewMediaDto,
  ) {
    const { sub } = this.user(req);
    return this.reviewMediaService.register(sub, reviewId, dto);
  }

  @Patch(REVIEW_ROUTES.MEDIA_REORDER)
  @Roles(UserRole.USER)
  @ResponseMessage('Review media reordered successfully.')
  reorderMedia(
    @Req() req: FastifyRequest,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReorderReviewMediaDto,
  ) {
    const { sub } = this.user(req);
    return this.reviewMediaService.reorder(sub, reviewId, dto);
  }

  @Delete(REVIEW_ROUTES.MEDIA_ITEM)
  @Roles(UserRole.USER)
  @ResponseMessage('Review media removed successfully.')
  deleteMedia(
    @Req() req: FastifyRequest,
    @Param('reviewId') reviewId: string,
    @Param('mediaId') mediaId: string,
  ) {
    const { sub } = this.user(req);
    return this.reviewMediaService.remove(sub, reviewId, mediaId);
  }
}
