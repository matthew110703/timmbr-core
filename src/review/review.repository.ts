import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Review,
  ReviewMedia,
  ReviewModerationAction,
  ReviewModerationEvent,
  ReviewRevisionStatus,
  ReviewStatus,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ReviewPublicSortBy } from './dto/get-product-reviews-query.dto';

const liveMediaInclude = {
  where: { revisionId: null },
  orderBy: { sortOrder: 'asc' as const },
};

const reviewWithRelations = {
  media: liveMediaInclude,
  revisions: {
    where: { status: ReviewRevisionStatus.PENDING },
    take: 1,
    include: { media: { orderBy: { sortOrder: 'asc' as const } } },
  },
} satisfies Prisma.ReviewInclude;

const publicReviewInclude = {
  media: liveMediaInclude,
} satisfies Prisma.ReviewInclude;

export type PublicReviewRow = Prisma.ReviewGetPayload<{ include: typeof publicReviewInclude }>;

export const reviewIdLiteSelect = {
  id: true,
  userId: true,
  productId: true,
  status: true,
  rating: true,
  helpfulCount: true,
} as const;

export type ReviewIdLite = Prisma.ReviewGetPayload<{ select: typeof reviewIdLiteSelect }>;

export type ReviewWithRelations = Prisma.ReviewGetPayload<{ include: typeof reviewWithRelations }>;

@Injectable()
export class ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ReviewWithRelations | null> {
    return this.prisma.review.findUnique({
      where: { id },
      include: reviewWithRelations,
    });
  }

  async findByIdLite(id: string): Promise<ReviewIdLite | null> {
    return this.prisma.review.findUnique({
      where: { id },
      select: reviewIdLiteSelect,
    });
  }

  async existsById(id: string): Promise<boolean> {
    const row = await this.prisma.review.findUnique({
      where: { id },
      select: { id: true },
    });
    return row !== null;
  }

  async findByOrderAndProduct(orderId: string, productId: string): Promise<Review | null> {
    return this.prisma.review.findUnique({
      where: { orderId_productId: { orderId, productId } },
    });
  }

  async create(data: Prisma.ReviewUncheckedCreateInput): Promise<ReviewWithRelations> {
    return this.prisma.review.create({
      data,
      include: reviewWithRelations,
    });
  }

  async update(id: string, data: Prisma.ReviewUpdateInput): Promise<ReviewWithRelations> {
    return this.prisma.review.update({
      where: { id },
      data,
      include: reviewWithRelations,
    });
  }

  async updateStatus(id: string, status: ReviewStatus): Promise<ReviewWithRelations> {
    return this.update(id, { status });
  }

  async findPublishedForProduct(
    productId: string,
    query: {
      page: number;
      limit: number;
      sortBy: ReviewPublicSortBy;
      rating?: number;
      hasImages?: boolean;
      hasVideos?: boolean;
    },
  ): Promise<[PublicReviewRow[], number]> {
    const where: Prisma.ReviewWhereInput = {
      productId,
      status: ReviewStatus.PUBLISHED,
      ...(query.rating !== undefined ? { rating: query.rating } : {}),
      ...(query.hasImages
        ? {
            media: {
              some: { revisionId: null, kind: 'IMAGE' },
            },
          }
        : {}),
      ...(query.hasVideos
        ? {
            media: {
              some: { revisionId: null, kind: 'VIDEO' },
            },
          }
        : {}),
    };

    const orderBy = this.publicSortOrder(query.sortBy);

    return this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy,
        include: publicReviewInclude,
      }),
      this.prisma.review.count({ where }),
    ]);
  }

  async findByUserId(
    userId: string,
    page: number,
    limit: number,
  ): Promise<[ReviewWithRelations[], number]> {
    return this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: reviewWithRelations,
      }),
      this.prisma.review.count({ where: { userId } }),
    ]);
  }

  async findAdminPaginated(
    where: Prisma.ReviewWhereInput,
    page: number,
    limit: number,
  ): Promise<[ReviewWithRelations[], number]> {
    return this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: reviewWithRelations,
      }),
      this.prisma.review.count({ where }),
    ]);
  }

  async createRevision(data: Prisma.ReviewRevisionUncheckedCreateInput) {
    return this.prisma.reviewRevision.create({ data });
  }

  async findRevisionById(id: string) {
    return this.prisma.reviewRevision.findUnique({
      where: { id },
      include: { media: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async updateRevision(id: string, data: Prisma.ReviewRevisionUpdateInput) {
    return this.prisma.reviewRevision.update({ where: { id }, data });
  }

  async deleteRevisionsForReview(reviewId: string, status?: ReviewRevisionStatus) {
    return this.prisma.reviewRevision.deleteMany({
      where: { reviewId, ...(status ? { status } : {}) },
    });
  }

  async createMedia(data: Prisma.ReviewMediaUncheckedCreateInput): Promise<ReviewMedia> {
    return this.prisma.reviewMedia.create({ data });
  }

  async deleteMedia(id: string): Promise<ReviewMedia> {
    return this.prisma.reviewMedia.delete({ where: { id } });
  }

  async findMediaById(id: string): Promise<ReviewMedia | null> {
    return this.prisma.reviewMedia.findUnique({ where: { id } });
  }

  async countLiveMedia(reviewId: string, kind?: 'IMAGE' | 'VIDEO'): Promise<number> {
    return this.prisma.reviewMedia.count({
      where: {
        reviewId,
        revisionId: null,
        ...(kind ? { kind } : {}),
      },
    });
  }

  async countLiveMediaByKind(reviewId: string): Promise<{ images: number; videos: number }> {
    const groups = await this.prisma.reviewMedia.groupBy({
      by: ['kind'],
      where: { reviewId, revisionId: null },
      _count: { _all: true },
    });
    let images = 0;
    let videos = 0;
    for (const group of groups) {
      if (group.kind === 'IMAGE') images = group._count._all;
      if (group.kind === 'VIDEO') videos = group._count._all;
    }
    return { images, videos };
  }

  async countRevisionMediaByKind(revisionId: string): Promise<{ images: number; videos: number }> {
    const groups = await this.prisma.reviewMedia.groupBy({
      by: ['kind'],
      where: { revisionId },
      _count: { _all: true },
    });
    let images = 0;
    let videos = 0;
    for (const group of groups) {
      if (group.kind === 'IMAGE') images = group._count._all;
      if (group.kind === 'VIDEO') videos = group._count._all;
    }
    return { images, videos };
  }

  async reorderLiveMedia(reviewId: string, mediaIds: string[]): Promise<void> {
    if (mediaIds.length === 0) return;

    await this.prisma.$executeRawUnsafe(
      `
      UPDATE "ReviewMedia" AS m
      SET "sortOrder" = ord.idx - 1, "updatedAt" = NOW()
      FROM unnest($1::text[]) WITH ORDINALITY AS ord(id, idx)
      WHERE m.id = ord.id
        AND m."reviewId" = $2
        AND m."revisionId" IS NULL
      `,
      mediaIds,
      reviewId,
    );
  }

  async createModerationEvent(
    data: Prisma.ReviewModerationEventUncheckedCreateInput,
  ): Promise<ReviewModerationEvent> {
    return this.prisma.reviewModerationEvent.create({ data });
  }

  async listModerationEvents(reviewId: string): Promise<ReviewModerationEvent[]> {
    return this.prisma.reviewModerationEvent.findMany({
      where: { reviewId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createHelpfulVote(reviewId: string, userId: string) {
    return this.prisma.reviewHelpfulVote.create({ data: { reviewId, userId } });
  }

  async deleteHelpfulVote(reviewId: string, userId: string) {
    return this.prisma.reviewHelpfulVote.delete({
      where: { reviewId_userId: { reviewId, userId } },
    });
  }

  async incrementHelpfulCount(reviewId: string, delta: number) {
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount: { increment: delta } },
    });
  }

  async recordModeration(
    reviewId: string,
    actorId: string,
    action: ReviewModerationAction,
    reason?: string | null,
    revisionId?: string | null,
  ) {
    return this.createModerationEvent({
      reviewId,
      actorId,
      action,
      reason: reason ?? null,
      revisionId: revisionId ?? null,
    });
  }

  async findOrphanMediaCandidates(olderThan: Date, take: number) {
    return this.prisma.reviewMedia.findMany({
      where: {
        createdAt: { lt: olderThan },
        review: { status: { in: [ReviewStatus.REJECTED] } },
      },
      take,
      select: { id: true, storageKey: true, thumbnailStorageKey: true },
    });
  }

  private publicSortOrder(sortBy: ReviewPublicSortBy): Prisma.ReviewOrderByWithRelationInput[] {
    switch (sortBy) {
      case ReviewPublicSortBy.OLDEST:
        return [{ createdAt: 'asc' }];
      case ReviewPublicSortBy.HIGHEST_RATING:
        return [{ rating: 'desc' }, { createdAt: 'desc' }];
      case ReviewPublicSortBy.LOWEST_RATING:
        return [{ rating: 'asc' }, { createdAt: 'desc' }];
      case ReviewPublicSortBy.MOST_HELPFUL:
        return [{ helpfulCount: 'desc' }, { createdAt: 'desc' }];
      case ReviewPublicSortBy.NEWEST:
      default:
        return [{ createdAt: 'desc' }];
    }
  }
}
