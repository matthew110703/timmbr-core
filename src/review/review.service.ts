import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
  ReviewRevisionNotFoundException,
} from '@/common/exceptions/review.exception';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { GetProductReviewsQueryDto, ReviewPublicSortBy } from './dto/get-product-reviews-query.dto';
import { GetReviewEligibilityQueryDto } from './dto/get-eligibility-query.dto';
import { ReviewEligibilityResponseDto } from './dto/review-eligibility-response.dto';
import { ProductReviewSummaryResponseDto, ReviewResponseDto } from './dto/review-response.dto';
import { AdminReviewModerationDto } from './dto/admin-moderation.dto';
import {
  AdminReviewCountsResponseDto,
  AdminReviewSortBy,
  GetAdminReviewsQueryDto,
} from './dto/get-admin-reviews-query.dto';
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

const ADMIN_VIEW = { includeAllMedia: true, includeProduct: true, includeReviewer: true } as const;

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: ReviewRepository,
    private readonly aggregateService: ReviewAggregateService,
    private readonly mediaService: MediaService,
  ) {}

  private resolveUrl = (key: string) => this.mediaService.getPublicUrl(key);

  async getEligibility(
    userId: string,
    query: GetReviewEligibilityQueryDto,
  ): Promise<ReviewEligibilityResponseDto> {
    const { productId, orderId } = query;
    if (orderId) {
      const eligible = await this.checkEligibility(userId, orderId, productId);
      const existing = await this.repository.findByOrderAndProduct(orderId, productId);
      return {
        eligible,
        productId,
        orderId,
        existingReviewId: existing?.id ?? null,
      };
    }

    const orders = await this.repository.findDeliveredOrderOptionsForProduct(userId, productId);
    return {
      eligible: orders.some((o) => !o.existingReviewId),
      productId,
      orders,
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

    return ReviewMapper.toResponse(review, this.resolveUrl, {
      viewerUserId: userId,
      includeProduct: true,
    });
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
      if (pending) {
        await this.repository.updateRevision(pending.id, {
          rating: nextRating,
          title: nextTitle,
          comment: nextComment,
        });
      } else {
        const created = await this.repository.createRevision({
          reviewId: review.id,
          rating: nextRating,
          title: nextTitle,
          comment: nextComment,
          status: ReviewRevisionStatus.PENDING,
        });
        await this.repository.cloneLiveMediaToRevision(review.id, created.id);
      }
      const refreshed = await this.repository.findById(review.id);
      if (!refreshed) throw new ReviewNotFoundException();
      return ReviewMapper.toResponse(refreshed, this.resolveUrl, {
        viewerUserId: userId,
        includeProduct: true,
      });
    }

    // A clean edit supersedes any held revision: drop it and apply this edit, never the held text.
    if (review.revisions.some((r) => r.status === ReviewRevisionStatus.PENDING)) {
      await this.repository.deleteRevisionsForReview(review.id, ReviewRevisionStatus.PENDING);
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

    return ReviewMapper.toResponse(updated, this.resolveUrl, {
      viewerUserId: userId,
      includeProduct: true,
    });
  }

  async remove(userId: string, reviewId: string): Promise<{ deleted: true }> {
    const review = await this.findOwned(userId, reviewId);
    const keys = await this.repository.findMediaStorageKeys(review.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id: review.id } });
      if (review.status === ReviewStatus.PUBLISHED) {
        await this.aggregateService.refreshProductRatings(review.productId, tx);
      }
    });

    for (const key of keys) {
      try {
        await this.mediaService.delete(key);
      } catch {
        this.logger.warn(`Failed to delete review media object ${key}`);
      }
    }
    return { deleted: true };
  }

  async listPublicForProduct(
    productId: string,
    query: GetProductReviewsQueryDto,
    viewerUserId?: string,
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

    const voted =
      viewerUserId !== undefined
        ? await this.repository.findHelpfulVoteReviewIds(
            viewerUserId,
            rows.map((r) => r.id),
          )
        : new Set<string>();

    return {
      data: rows.map((r) =>
        ReviewMapper.toResponse(r, this.resolveUrl, {
          viewerUserId,
          votedByViewer: viewerUserId ? voted.has(r.id) : false,
          publicAudience: true,
        }),
      ),
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
      data: rows.map((r) =>
        ReviewMapper.toResponse(r, this.resolveUrl, {
          viewerUserId: userId,
          includeProduct: true,
        }),
      ),
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
      includeProduct: true,
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
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
        throw err;
      }
    }

    return this.voterView(userId, reviewId, true);
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

    return this.voterView(userId, reviewId, false);
  }

  /** A voter sees the review as the public does: no pending revision, no author userId. */
  private async voterView(userId: string, reviewId: string, votedByViewer: boolean) {
    const refreshed = await this.repository.findById(reviewId);
    if (!refreshed) throw new ReviewNotFoundException();
    return ReviewMapper.toResponse(refreshed, this.resolveUrl, {
      viewerUserId: userId,
      votedByViewer,
      publicAudience: true,
    });
  }

  async listAdmin(query: GetAdminReviewsQueryDto): Promise<PaginatedResult<ReviewResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ReviewWhereInput = {
      ...this.adminFilterWhere(query),
      ...(query.status ? { status: query.status } : {}),
    };
    const orderBy: Prisma.ReviewOrderByWithRelationInput[] =
      query.sortBy === AdminReviewSortBy.RATING
        ? [{ rating: query.order ?? 'desc' }, { createdAt: 'desc' }]
        : [{ createdAt: query.order ?? 'desc' }];
    const [rows, total] = await this.repository.findAdminPaginated(where, page, limit, orderBy);
    return {
      data: rows.map((r) => ReviewMapper.toResponse(r, this.resolveUrl, ADMIN_VIEW)),
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

  async countAdminByStatus(query: GetAdminReviewsQueryDto): Promise<AdminReviewCountsResponseDto> {
    const counts = await this.repository.countByStatus(this.adminFilterWhere(query));
    return {
      PENDING: counts.PENDING ?? 0,
      PUBLISHED: counts.PUBLISHED ?? 0,
      HIDDEN: counts.HIDDEN ?? 0,
      REJECTED: counts.REJECTED ?? 0,
      total: Object.values(counts).reduce((sum, n) => sum + n, 0),
    };
  }

  async getAdminById(reviewId: string): Promise<ReviewResponseDto> {
    const review = await this.repository.findById(reviewId);
    if (!review) throw new ReviewNotFoundException();
    return ReviewMapper.toResponse(review, this.resolveUrl, ADMIN_VIEW);
  }

  async approveReview(actorId: string, reviewId: string, dto: AdminReviewModerationDto) {
    return this.transitionStatus(actorId, reviewId, dto, {
      from: ReviewStatus.PENDING,
      to: ReviewStatus.PUBLISHED,
      action: ReviewModerationAction.APPROVE,
    });
  }

  async rejectReview(actorId: string, reviewId: string, dto: AdminReviewModerationDto) {
    this.assertModerationReason(dto);
    return this.transitionStatus(actorId, reviewId, dto, {
      from: ReviewStatus.PENDING,
      to: ReviewStatus.REJECTED,
      action: ReviewModerationAction.REJECT,
    });
  }

  async hideReview(actorId: string, reviewId: string, dto: AdminReviewModerationDto) {
    this.assertModerationReason(dto);
    return this.transitionStatus(actorId, reviewId, dto, {
      from: ReviewStatus.PUBLISHED,
      to: ReviewStatus.HIDDEN,
      action: ReviewModerationAction.HIDE,
    });
  }

  async restoreReview(actorId: string, reviewId: string, dto: AdminReviewModerationDto) {
    return this.transitionStatus(actorId, reviewId, dto, {
      from: ReviewStatus.HIDDEN,
      to: ReviewStatus.PUBLISHED,
      action: ReviewModerationAction.RESTORE,
    });
  }

  /** Status change and its audit event commit together; ratings refresh when visibility flips. */
  private async transitionStatus(
    actorId: string,
    reviewId: string,
    dto: AdminReviewModerationDto,
    transition: { from: ReviewStatus; to: ReviewStatus; action: ReviewModerationAction },
  ): Promise<ReviewResponseDto> {
    const review = await this.repository.findByIdLite(reviewId);
    if (!review) throw new ReviewNotFoundException();
    if (review.status !== transition.from) throw new ReviewInvalidTransitionException();

    const visibilityChanges =
      transition.from === ReviewStatus.PUBLISHED || transition.to === ReviewStatus.PUBLISHED;

    await this.prisma.$transaction(async (tx) => {
      await tx.review.update({ where: { id: reviewId }, data: { status: transition.to } });
      await tx.reviewModerationEvent.create({
        data: { reviewId, actorId, action: transition.action, reason: dto.reason ?? null },
      });
      if (visibilityChanges) {
        await this.aggregateService.refreshProductRatings(review.productId, tx);
      }
    });

    return this.getAdminById(reviewId);
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
          // A hidden review stays hidden; approving its edit must not republish it.
          status:
            review.status === ReviewStatus.HIDDEN ? ReviewStatus.HIDDEN : ReviewStatus.PUBLISHED,
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
    return this.getAdminById(reviewId);
  }

  async rejectRevision(
    actorId: string,
    reviewId: string,
    revisionId: string,
    dto: AdminReviewModerationDto,
  ) {
    this.assertModerationReason(dto);
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

    return this.getAdminById(reviewId);
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

  private assertModerationReason(dto: AdminReviewModerationDto) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('A reason is required for this action.');
    }
  }

  /** Every admin list filter except status, so status tab counts honour the active filters. */
  private adminFilterWhere(query: GetAdminReviewsQueryDto): Prisma.ReviewWhereInput {
    const search = query.search?.trim();
    const and: Prisma.ReviewWhereInput[] = [];
    if (query.rating !== undefined) and.push({ rating: query.rating });
    if (query.hasPendingRevision) {
      and.push({ revisions: { some: { status: ReviewRevisionStatus.PENDING } } });
    }
    if (query.hasMedia) and.push({ media: { some: { revisionId: null } } });
    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { comment: { contains: search, mode: 'insensitive' } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { product: { title: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }
    return and.length > 0 ? { AND: and } : {};
  }
}
