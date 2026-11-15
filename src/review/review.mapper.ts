import { ReviewStatus } from '@prisma/client';
import {
  PendingRevisionResponseDto,
  ReviewMediaResponseDto,
  ReviewResponseDto,
} from './dto/review-response.dto';
import { ReviewModerationEventResponseDto } from './dto/review-moderation-event-response.dto';
import {
  ModerationEventWithActor,
  PublicReviewRow,
  ReviewWithRelations,
} from './review.repository';

type ReviewMappable = ReviewWithRelations | PublicReviewRow;

type ProductEmbed = {
  id: string;
  title: string;
  slug: string;
  images?: { storageKey: string }[];
};

type UserEmbed = { id?: string; name: string };

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

  private static pendingRevision(
    review: ReviewWithRelations,
    resolveUrl: (key: string) => string,
  ): PendingRevisionResponseDto | null {
    const revision = review.revisions[0];
    if (!revision) return null;
    return {
      id: revision.id,
      rating: revision.rating,
      title: revision.title,
      comment: revision.comment,
      media: revision.media.map((m) => ReviewMapper.toMediaResponse(m, resolveUrl)),
    };
  }

  private static productSummary(
    product: ProductEmbed | undefined,
    resolveUrl: (key: string) => string,
  ) {
    if (!product) return undefined;
    const thumb = product.images?.[0]?.storageKey;
    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      thumbnailUrl: thumb ? resolveUrl(thumb) : null,
    };
  }

  static toResponse(
    review: ReviewMappable,
    resolveUrl: (key: string) => string,
    options?: {
      includeAllMedia?: boolean;
      viewerUserId?: string;
      votedByViewer?: boolean;
      includeProduct?: boolean;
      includeReviewer?: boolean;
      publicAudience?: boolean;
    },
  ): ReviewResponseDto {
    const isOwner = options?.viewerUserId === review.userId;
    const isPublic = review.status === ReviewStatus.PUBLISHED;
    const showMedia = isPublic || isOwner || options?.includeAllMedia === true;

    const liveMedia =
      'revisions' in review ? review.media.filter((m) => m.revisionId === null) : review.media;

    const withRelations = review as ReviewWithRelations;
    const omitUserId = options?.publicAudience === true && !isOwner;
    // Unmoderated revision content is for its author and admins only.
    const showRevision = isOwner || options?.includeAllMedia === true;

    const fullName =
      'user' in review && review.user && 'name' in review.user
        ? (review.user as UserEmbed).name
        : null;
    const authorName = omitUserId ? ReviewMapper.publicName(fullName) : (fullName ?? 'Customer');

    const response: ReviewResponseDto = {
      id: review.id,
      productId: review.productId,
      orderId: review.orderId,
      authorName,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      status: review.status,
      helpfulCount: review.helpfulCount,
      verifiedPurchase: true,
      pendingRevision:
        showRevision && 'revisions' in review
          ? ReviewMapper.pendingRevision(withRelations, resolveUrl)
          : null,
      media: showMedia ? liveMedia.map((m) => ReviewMapper.toMediaResponse(m, resolveUrl)) : [],
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };

    if (!omitUserId) {
      response.userId = review.userId;
    }

    if (options?.votedByViewer !== undefined) {
      response.votedByViewer = options.votedByViewer;
    }

    if (options?.includeProduct && 'product' in review && withRelations.product) {
      response.product = ReviewMapper.productSummary(withRelations.product, resolveUrl);
    }

    // The author sees why their review was rejected or hidden; the public never does.
    const lastEvent =
      showRevision && 'moderationEvents' in review ? review.moderationEvents[0] : undefined;
    if (lastEvent) {
      response.lastModeration = {
        action: lastEvent.action,
        reason: lastEvent.reason,
        createdAt: lastEvent.createdAt,
      };
    }

    if (options?.includeReviewer && 'user' in review && withRelations.user?.id) {
      response.reviewer = {
        id: withRelations.user.id,
        name: withRelations.user.name,
      };
    }

    return response;
  }

  /** "Priya Sharma" → "Priya S." so public lists never expose a full name. */
  private static publicName(fullName: string | null): string {
    const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
    if (parts.length === 0) return 'Customer';
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
  }

  static toModerationEventResponse(
    event: ModerationEventWithActor,
  ): ReviewModerationEventResponseDto {
    return {
      id: event.id,
      reviewId: event.reviewId,
      revisionId: event.revisionId,
      actorId: event.actorId,
      actor: event.actor ? { id: event.actor.id, name: event.actor.name } : null,
      action: event.action,
      reason: event.reason,
      createdAt: event.createdAt,
    };
  }
}
