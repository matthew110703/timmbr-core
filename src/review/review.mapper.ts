import { ReviewStatus } from '@prisma/client';
import { ReviewMediaResponseDto, ReviewResponseDto } from './dto/review-response.dto';
import { ReviewModerationEventResponseDto } from './dto/review-moderation-event-response.dto';
import { ReviewModerationEvent } from '@prisma/client';
import { PublicReviewRow, ReviewWithRelations } from './review.repository';

type ReviewMappable = ReviewWithRelations | PublicReviewRow;

export class ReviewMapper {
  static toMediaResponse(
    media: {
      id: string;
      kind: ReviewMediaResponseDto['kind'];
      storageKey: string;
      thumbnailStorageKey: string | null;
      sortOrder: number;
    },
    resolveUrl: (key: string) => string,
  ): ReviewMediaResponseDto {
    return {
      id: media.id,
      kind: media.kind,
      url: resolveUrl(media.storageKey),
      thumbnailUrl: media.thumbnailStorageKey ? resolveUrl(media.thumbnailStorageKey) : null,
      sortOrder: media.sortOrder,
    };
  }

  static toResponse(
    review: ReviewMappable,
    resolveUrl: (key: string) => string,
    options?: { includeAllMedia?: boolean; viewerUserId?: string },
  ): ReviewResponseDto {
    const isOwner = options?.viewerUserId === review.userId;
    const isPublic = review.status === ReviewStatus.PUBLISHED;
    const showMedia = isPublic || isOwner || options?.includeAllMedia === true;

    const liveMedia =
      'revisions' in review ? review.media.filter((m) => m.revisionId === null) : review.media;

    return {
      id: review.id,
      productId: review.productId,
      orderId: review.orderId,
      userId: review.userId,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      status: review.status,
      helpfulCount: review.helpfulCount,
      verifiedPurchase: true,
      hasPendingRevision: 'revisions' in review ? review.revisions.length > 0 : false,
      media: showMedia ? liveMedia.map((m) => ReviewMapper.toMediaResponse(m, resolveUrl)) : [],
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }

  static toModerationEventResponse(event: ReviewModerationEvent): ReviewModerationEventResponseDto {
    return {
      id: event.id,
      reviewId: event.reviewId,
      revisionId: event.revisionId,
      actorId: event.actorId,
      action: event.action,
      reason: event.reason,
      createdAt: event.createdAt,
    };
  }
}
