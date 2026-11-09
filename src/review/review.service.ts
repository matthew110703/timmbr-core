import { Injectable } from '@nestjs/common';
import {
  OrderStatus,
  ReviewModerationAction,
  ReviewRevisionStatus,
  ReviewStatus,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { PaginatedResult } from '@/common/types/api-response.types';
import { ProductNotFoundException } from '@/common/exceptions/product.exception';
import {
  ReviewAlreadyExistsException,
  ReviewForbiddenException,
  ReviewInvalidTransitionException,
  ReviewNotEligibleException,
  ReviewNotFoundException,
  ReviewPendingRevisionExistsException,
  ReviewRevisionNotFoundException,
} from '@/common/exceptions/review.exception';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { GetProductReviewsQueryDto, ReviewPublicSortBy } from './dto/get-product-reviews-query.dto';
import { ReviewEligibilityResponseDto } from './dto/review-eligibility-response.dto';
import { ProductReviewSummaryResponseDto, ReviewResponseDto } from './dto/review-response.dto';
import { AdminReviewModerationDto } from './dto/admin-moderation.dto';
import { GetAdminReviewsQueryDto } from './dto/get-admin-reviews-query.dto';
import { ReviewModerationEventResponseDto } from './dto/review-moderation-event-response.dto';
import { ReviewAggregateService } from './review-aggregate.service';
import { ReviewRepository } from './review.repository';
import { ReviewMapper } from './review.mapper';
import { sanitizeReviewComment } from './utils/review-sanitize.util';
import { reviewRequiresModeration } from './utils/review-moderation.util';
import { MediaService } from '@/media/media.service';
import {
  ReviewHelpfulNotPublishedException,
  ReviewHelpfulSelfVoteException,
} from '@/common/exceptions/review.exception';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: ReviewRepository,
    private readonly aggregateService: ReviewAggregateService,
    private readonly mediaService: MediaService,
  ) {}

  private resolveUrl = (key: string) => this.mediaService.getPublicUrl(key);

  async getEligibility(
    userId: string,
    orderId: string,
    productId: string,
  ): Promise<ReviewEligibilityResponseDto> {
    const eligible = await this.checkEligibility(userId, orderId, productId);
    const existing = await this.repository.findByOrderAndProduct(orderId, productId);
    return {
      eligible,
      orderId,
      productId,
      existingReviewId: existing?.id ?? null,
    };
  }

  async create(userId: string, dto: CreateReviewDto): Promise<ReviewResponseDto> {
    await this.assertEligibility(userId, dto.orderId, dto.productId);

    const existing = await this.repository.findByOrderAndProduct(dto.orderId, dto.productId);
    if (existing) throw new ReviewAlreadyExistsException();

    const title = dto.title?.trim() || null;
    const comment = sanitizeReviewComment(dto.comment);
    const needsModeration = reviewRequiresModeration({ title, comment });
    const status = needsModeration ? ReviewStatus.PENDING : ReviewStatus.PUBLISHED;

    const review = await this.repository.create({
      userId,
      productId: dto.productId,
      orderId: dto.orderId,
      rating: dto.rating,
      title,
      comment,
      status,
    });

    if (status === ReviewStatus.PUBLISHED) {
      await this.aggregateService.refreshProductRatings(dto.productId);
    }

    return ReviewMapper.toResponse(review, this.resolveUrl, { viewerUserId: userId });
  }

  async update(userId: string, reviewId: string, dto: UpdateReviewDto): Promise<ReviewResponseDto> {
    const review = await this.findOwned(userId, reviewId);

    const nextRating = dto.rating ?? review.rating;
    const nextTitle = dto.title === undefined ? review.title : dto.title?.trim() || null;
    const nextComment =
      dto.comment === undefined ? review.comment : sanitizeReviewComment(dto.comment);

    const needsModeration = reviewRequiresModeration({
      title: nextTitle,
      comment: nextComment,
    });

    if (review.status === ReviewStatus.PUBLISHED && needsModeration) {
      const pending = review.revisions.find((r) => r.status === ReviewRevisionStatus.PENDING);
      if (pending) throw new ReviewPendingRevisionExistsException();

      await this.repository.createRevision({
        reviewId: review.id,
        rating: nextRating,
        title: nextTitle,
        comment: nextComment,
        status: ReviewRevisionStatus.PENDING,
      });
      const refreshed = await this.repository.findById(review.id);
      if (!refreshed) throw new ReviewNotFoundException();
      return ReviewMapper.toResponse(refreshed, this.resolveUrl, { viewerUserId: userId });
    }

    let nextStatus = review.status;
    if (review.status !== ReviewStatus.HIDDEN) {
      nextStatus = needsModeration ? ReviewStatus.PENDING : ReviewStatus.PUBLISHED;
    }

    const wasPublished = review.status === ReviewStatus.PUBLISHED;
    const willPublish = nextStatus === ReviewStatus.PUBLISHED;

    const updated = await this.repository.update(review.id, {
      rating: nextRating,
      title: nextTitle,
      comment: nextComment,
      status: nextStatus,
    });

    if (wasPublished !== willPublish || (willPublish && nextRating !== review.rating)) {
      await this.aggregateService.refreshProductRatings(review.productId);
    }

    return ReviewMapper.toResponse(updated, this.resolveUrl, { viewerUserId: userId });
  }

  async listPublicForProduct(
    productId: string,
    query: GetProductReviewsQueryDto,
  ): Promise<PaginatedResult<ReviewResponseDto>> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new ProductNotFoundException();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? ReviewPublicSortBy.NEWEST;

    const [rows, total] = await this.repository.findPublishedForProduct(productId, {
      page,
      limit,
      sortBy,
      rating: query.rating,
      hasImages: query.hasImages,
      hasVideos: query.hasVideos,
    });

    return {
      data: rows.map((r) => ReviewMapper.toResponse(r, this.resolveUrl)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async getProductSummary(productId: string): Promise<ProductReviewSummaryResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        ratingAvg: true,
        ratingCount: true,
        rating1Count: true,
        rating2Count: true,
        rating3Count: true,
        rating4Count: true,
        rating5Count: true,
      },
    });
    if (!product) throw new ProductNotFoundException();

    return {
      ratingAvg: product.ratingAvg ? Number(product.ratingAvg) : null,
      ratingCount: product.ratingCount,
      rating1Count: product.rating1Count,
      rating2Count: product.rating2Count,
      rating3Count: product.rating3Count,
      rating4Count: product.rating4Count,
      rating5Count: product.rating5Count,
    };
  }

  async listMine(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<ReviewResponseDto>> {
    const [rows, total] = await this.repository.findByUserId(userId, page, limit);
    return {
      data: rows.map((r) => ReviewMapper.toResponse(r, this.resolveUrl, { viewerUserId: userId })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async getOneForOwner(userId: string, reviewId: string): Promise<ReviewResponseDto> {
    const review = await this.findOwned(userId, reviewId);
    return ReviewMapper.toResponse(review, this.resolveUrl, {
      viewerUserId: userId,
      includeAllMedia: true,
    });
  }

  async addHelpfulVote(userId: string, reviewId: string): Promise<ReviewResponseDto> {
    const review = await this.repository.findByIdLite(reviewId);
    if (!review) throw new ReviewNotFoundException();
    if (review.userId === userId) throw new ReviewHelpfulSelfVoteException();
    if (review.status !== ReviewStatus.PUBLISHED) throw new ReviewHelpfulNotPublishedException();

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.reviewHelpfulVote.create({ data: { reviewId, userId } });
        await tx.review.update({
          where: { id: reviewId },
          data: { helpfulCount: { increment: 1 } },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const refreshed = await this.repository.findById(reviewId);
        if (!refreshed) throw new ReviewNotFoundException();
        return ReviewMapper.toResponse(refreshed, this.resolveUrl, { viewerUserId: userId });
      }
      throw err;
    }

    const refreshed = await this.repository.findById(reviewId);
    if (!refreshed) throw new ReviewNotFoundException();
    return ReviewMapper.toResponse(refreshed, this.resolveUrl, { viewerUserId: userId });
  }

  async removeHelpfulVote(userId: string, reviewId: string): Promise<ReviewResponseDto> {
    const review = await this.repository.findByIdLite(reviewId);
    if (!review) throw new ReviewNotFoundException();

    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.reviewHelpfulVote.delete({
          where: { reviewId_userId: { reviewId, userId } },
        });
        await tx.review.update({
          where: { id: reviewId },
          data: { helpfulCount: { decrement: 1 } },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          return;
        }
        throw err;
      }
    });

    const refreshed = await this.repository.findById(reviewId);
    if (!refreshed) throw new ReviewNotFoundException();
    return ReviewMapper.toResponse(refreshed, this.resolveUrl, { viewerUserId: userId });
  }

  async listAdmin(query: GetAdminReviewsQueryDto): Promise<PaginatedResult<ReviewResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = query.status ? { status: query.status } : {};
    const [rows, total] = await this.repository.findAdminPaginated(where, page, limit);
    return {
      data: rows.map((r) => ReviewMapper.toResponse(r, this.resolveUrl, { includeAllMedia: true })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async getAdminById(reviewId: string): Promise<ReviewResponseDto> {
    const review = await this.repository.findById(reviewId);
    if (!review) throw new ReviewNotFoundException();
    return ReviewMapper.toResponse(review, this.resolveUrl, { includeAllMedia: true });
  }

  async approveReview(actorId: string, reviewId: string, dto: AdminReviewModerationDto) {
    const review = await this.repository.findByIdLite(reviewId);
    if (!review) throw new ReviewNotFoundException();
    if (review.status !== ReviewStatus.PENDING) throw new ReviewInvalidTransitionException();

    const updated = await this.repository.updateStatus(reviewId, ReviewStatus.PUBLISHED);
    await this.repository.recordModeration(
      reviewId,
      actorId,
      ReviewModerationAction.APPROVE,
      dto.reason,
    );
    await this.aggregateService.refreshProductRatings(review.productId);
    return ReviewMapper.toResponse(updated, this.resolveUrl, { includeAllMedia: true });
  }

  async rejectReview(actorId: string, reviewId: string, dto: AdminReviewModerationDto) {
    const review = await this.repository.findByIdLite(reviewId);
    if (!review) throw new ReviewNotFoundException();
    if (review.status !== ReviewStatus.PENDING) throw new ReviewInvalidTransitionException();

    const updated = await this.repository.updateStatus(reviewId, ReviewStatus.REJECTED);
    await this.repository.recordModeration(
      reviewId,
      actorId,
      ReviewModerationAction.REJECT,
      dto.reason,
    );
    return ReviewMapper.toResponse(updated, this.resolveUrl, { includeAllMedia: true });
  }

  async hideReview(actorId: string, reviewId: string, dto: AdminReviewModerationDto) {
    const review = await this.repository.findByIdLite(reviewId);
    if (!review) throw new ReviewNotFoundException();
    if (review.status !== ReviewStatus.PUBLISHED) throw new ReviewInvalidTransitionException();

    const updated = await this.repository.updateStatus(reviewId, ReviewStatus.HIDDEN);
    await this.repository.recordModeration(
      reviewId,
      actorId,
      ReviewModerationAction.HIDE,
      dto.reason,
    );
    await this.aggregateService.refreshProductRatings(review.productId);
    return ReviewMapper.toResponse(updated, this.resolveUrl, { includeAllMedia: true });
  }

  async restoreReview(actorId: string, reviewId: string, dto: AdminReviewModerationDto) {
    const review = await this.repository.findByIdLite(reviewId);
    if (!review) throw new ReviewNotFoundException();
    if (review.status !== ReviewStatus.HIDDEN) throw new ReviewInvalidTransitionException();

    const updated = await this.repository.updateStatus(reviewId, ReviewStatus.PUBLISHED);
    await this.repository.recordModeration(
      reviewId,
      actorId,
      ReviewModerationAction.RESTORE,
      dto.reason,
    );
    await this.aggregateService.refreshProductRatings(review.productId);
    return ReviewMapper.toResponse(updated, this.resolveUrl, { includeAllMedia: true });
  }

  async approveRevision(
    actorId: string,
    reviewId: string,
    revisionId: string,
    dto: AdminReviewModerationDto,
  ) {
    const review = await this.repository.findById(reviewId);
    if (!review) throw new ReviewNotFoundException();
    const revision = await this.repository.findRevisionById(revisionId);
    if (!revision || revision.reviewId !== reviewId) throw new ReviewRevisionNotFoundException();
    if (revision.status !== ReviewRevisionStatus.PENDING)
      throw new ReviewInvalidTransitionException();

    const productId = review.productId;
    await this.prisma.$transaction(async (tx) => {
      await tx.reviewMedia.deleteMany({
        where: { reviewId, revisionId: null },
      });
      await tx.reviewMedia.updateMany({
        where: { reviewId, revisionId },
        data: { revisionId: null },
      });
      await tx.review.update({
        where: { id: reviewId },
        data: {
          rating: revision.rating,
          title: revision.title,
          comment: revision.comment,
          status: ReviewStatus.PUBLISHED,
        },
      });
      await tx.reviewRevision.delete({ where: { id: revisionId } });
      await tx.reviewRevision.deleteMany({
        where: { reviewId, status: ReviewRevisionStatus.PENDING },
      });
      await tx.reviewModerationEvent.create({
        data: {
          reviewId,
          revisionId,
          actorId,
          action: ReviewModerationAction.APPROVE_REVISION,
          reason: dto.reason ?? null,
        },
      });
      await this.aggregateService.refreshProductRatings(productId, tx);
    });
    const updated = await this.repository.findById(reviewId);
    if (!updated) throw new ReviewNotFoundException();
    return ReviewMapper.toResponse(updated, this.resolveUrl, { includeAllMedia: true });
  }

  async rejectRevision(
    actorId: string,
    reviewId: string,
    revisionId: string,
    dto: AdminReviewModerationDto,
  ) {
    const revision = await this.repository.findRevisionById(revisionId);
    if (!revision || revision.reviewId !== reviewId) throw new ReviewRevisionNotFoundException();
    if (revision.status !== ReviewRevisionStatus.PENDING)
      throw new ReviewInvalidTransitionException();

    await this.prisma.$transaction(async (tx) => {
      await tx.reviewMedia.deleteMany({ where: { revisionId } });
      await tx.reviewRevision.update({
        where: { id: revisionId },
        data: { status: ReviewRevisionStatus.REJECTED },
      });
      await tx.reviewModerationEvent.create({
        data: {
          reviewId,
          revisionId,
          actorId,
          action: ReviewModerationAction.REJECT_REVISION,
          reason: dto.reason ?? null,
        },
      });
    });

    const updated = await this.repository.findById(reviewId);
    if (!updated) throw new ReviewNotFoundException();
    return ReviewMapper.toResponse(updated, this.resolveUrl, { includeAllMedia: true });
  }

  async getModerationHistory(reviewId: string): Promise<ReviewModerationEventResponseDto[]> {
    const exists = await this.repository.existsById(reviewId);
    if (!exists) throw new ReviewNotFoundException();
    const events = await this.repository.listModerationEvents(reviewId);
    return events.map((e) => ReviewMapper.toModerationEventResponse(e));
  }

  async findOwned(userId: string, reviewId: string) {
    const review = await this.repository.findById(reviewId);
    if (!review) throw new ReviewNotFoundException();
    if (review.userId !== userId) throw new ReviewForbiddenException();
    return review;
  }

  private async assertEligibility(userId: string, orderId: string, productId: string) {
    const eligible = await this.checkEligibility(userId, orderId, productId);
    if (!eligible) throw new ReviewNotEligibleException();
  }

  private async checkEligibility(
    userId: string,
    orderId: string,
    productId: string,
  ): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, status: true },
    });
    if (!order || order.userId !== userId || order.status !== OrderStatus.DELIVERED) {
      return false;
    }
    const line = await this.prisma.orderItem.findFirst({
      where: { orderId, productId },
      select: { id: true },
    });
    return line !== null;
  }
}
