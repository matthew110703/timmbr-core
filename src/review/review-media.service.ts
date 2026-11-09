import { Injectable, Logger } from '@nestjs/common';
import { ReviewMediaKind, ReviewRevisionStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { MediaService } from '@/media/media.service';
import {
  ReviewForbiddenException,
  ReviewInvalidStorageKeyException,
  ReviewMediaLimitException,
  ReviewMediaObjectNotFoundException,
  ReviewNotFoundException,
} from '@/common/exceptions/review.exception';
import { PresignReviewMediaDto } from './dto/presign-review-media.dto';
import { RegisterReviewMediaDto, ReorderReviewMediaDto } from './dto/register-review-media.dto';
import { REVIEW_CONSTANTS } from './review.constants';
import { validateReviewMediaItem } from './utils/review-media-validation.util';
import { ReviewRepository } from './review.repository';
import { ReviewService } from './review.service';
import { ReviewMapper } from './review.mapper';
import { ReviewMediaResponseDto } from './dto/review-response.dto';

@Injectable()
export class ReviewMediaService {
  private readonly logger = new Logger(ReviewMediaService.name);

  constructor(
    private readonly reviewService: ReviewService,
    private readonly repository: ReviewRepository,
    private readonly mediaService: MediaService,
  ) {}

  private resolveUrl = (key: string) => this.mediaService.getPublicUrl(key);

  async presign(userId: string, reviewId: string, dto: PresignReviewMediaDto) {
    await this.reviewService.findOwned(userId, reviewId);
    for (const file of dto.files) {
      validateReviewMediaItem(file.mimeType, file.sizeBytes);
    }

    return this.mediaService.getPresignedUploadUrls({
      folder: `reviews/${reviewId}/media`,
      files: dto.files,
    });
  }

  async register(userId: string, reviewId: string, dto: RegisterReviewMediaDto) {
    await this.reviewService.findOwned(userId, reviewId);
    const prefix = `reviews/${reviewId}/media/`;
    const created: ReviewMediaResponseDto[] = [];
    const liveCounts = await this.repository.countLiveMediaByKind(reviewId);
    const revisionCounts = new Map<string, { images: number; videos: number }>();

    for (const item of dto.media) {
      if (!item.storageKey.startsWith(prefix)) {
        throw new ReviewInvalidStorageKeyException(item.storageKey);
      }
      const detectedKind = validateReviewMediaItem(item.mimeType, item.sizeBytes);
      if (detectedKind !== item.kind) {
        throw new ReviewInvalidStorageKeyException(item.storageKey);
      }
      const exists = await this.mediaService.exists(item.storageKey);
      if (!exists) throw new ReviewMediaObjectNotFoundException(item.storageKey);

      const revisionId = item.revisionId ?? null;
      if (revisionId) {
        const revision = await this.repository.findRevisionById(revisionId);
        if (!revision || revision.reviewId !== reviewId) {
          throw new ReviewNotFoundException();
        }
        if (revision.status !== ReviewRevisionStatus.PENDING) {
          throw new ReviewForbiddenException();
        }
      }

      if (revisionId) {
        let counts = revisionCounts.get(revisionId);
        if (!counts) {
          counts = await this.repository.countRevisionMediaByKind(revisionId);
          revisionCounts.set(revisionId, { ...counts });
        }
        this.assertCountsAfterAdd(item.kind, counts, true);
        if (item.kind === ReviewMediaKind.IMAGE) counts.images += 1;
        else counts.videos += 1;
      } else {
        this.assertCountsAfterAdd(item.kind, liveCounts, false);
        if (item.kind === ReviewMediaKind.IMAGE) liveCounts.images += 1;
        else liveCounts.videos += 1;
      }

      let thumbnailKey: string | null = null;
      if (item.kind === ReviewMediaKind.IMAGE) {
        thumbnailKey = await this.generateThumbnail(item.storageKey, reviewId);
      }

      const row = await this.repository.createMedia({
        reviewId,
        revisionId,
        storageKey: item.storageKey,
        thumbnailStorageKey: thumbnailKey,
        kind: item.kind,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        sortOrder: item.sortOrder ?? 0,
      });

      created.push(ReviewMapper.toMediaResponse(row, this.resolveUrl));
    }

    return { media: created };
  }

  async reorder(userId: string, reviewId: string, dto: ReorderReviewMediaDto) {
    await this.reviewService.findOwned(userId, reviewId);
    await this.repository.reorderLiveMedia(reviewId, dto.mediaIds);
    return { reordered: true };
  }

  async remove(userId: string, reviewId: string, mediaId: string) {
    await this.reviewService.findOwned(userId, reviewId);
    const media = await this.repository.findMediaById(mediaId);
    if (!media || media.reviewId !== reviewId) {
      throw new ReviewNotFoundException();
    }

    await this.repository.deleteMedia(mediaId);
    try {
      await this.mediaService.delete(media.storageKey);
      if (media.thumbnailStorageKey) {
        await this.mediaService.delete(media.thumbnailStorageKey);
      }
    } catch {
      this.logger.warn(`Failed to delete review media object ${media.storageKey}`);
    }
    return { deleted: true };
  }

  async cleanupAbandonedMedia(maxAgeHours = 24, batchSize = 100) {
    const olderThan = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    const candidates = await this.repository.findOrphanMediaCandidates(olderThan, batchSize);
    let removed = 0;
    for (const row of candidates) {
      try {
        await this.mediaService.delete(row.storageKey);
        if (row.thumbnailStorageKey) {
          await this.mediaService.delete(row.thumbnailStorageKey);
        }
        await this.repository.deleteMedia(row.id);
        removed++;
      } catch {
        this.logger.warn(`Skipped cleanup for review media ${row.id}`);
      }
    }
    return { removed, scanned: candidates.length };
  }

  private assertCountsAfterAdd(
    kind: ReviewMediaKind,
    counts: { images: number; videos: number },
    isRevision: boolean,
  ) {
    const nextImages = counts.images + (kind === ReviewMediaKind.IMAGE ? 1 : 0);
    const nextVideos = counts.videos + (kind === ReviewMediaKind.VIDEO ? 1 : 0);
    if (nextImages > REVIEW_CONSTANTS.MAX_IMAGES) {
      throw new ReviewMediaLimitException(
        isRevision
          ? 'Too many images for this revision.'
          : 'Maximum image count reached for this review.',
      );
    }
    if (nextVideos > REVIEW_CONSTANTS.MAX_VIDEOS) {
      throw new ReviewMediaLimitException(
        isRevision
          ? 'Too many videos for this revision.'
          : 'Maximum video count reached for this review.',
      );
    }
  }

  private async generateThumbnail(storageKey: string, reviewId: string): Promise<string> {
    const buffer = await this.mediaService.getBuffer(storageKey);
    const image = sharp(buffer);
    const meta = await image.metadata();
    if (
      (meta.width ?? 0) > REVIEW_CONSTANTS.MAX_IMAGE_DIMENSION ||
      (meta.height ?? 0) > REVIEW_CONSTANTS.MAX_IMAGE_DIMENSION
    ) {
      throw new ReviewMediaLimitException('Image exceeds maximum dimensions.');
    }

    const thumb = await image
      .resize({ width: REVIEW_CONSTANTS.THUMBNAIL_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const thumbKey = `reviews/${reviewId}/media/thumbs/${randomUUID()}.webp`;
    await this.mediaService.putBuffer({
      key: thumbKey,
      body: thumb,
      contentType: 'image/webp',
    });
    return thumbKey;
  }
}
