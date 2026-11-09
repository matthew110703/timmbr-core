import {
  MediaEmptyFileException,
  MediaFileTooLargeException,
  MediaUnsupportedTypeException,
} from '@/common/exceptions/media.exception';
import {
  REVIEW_ALLOWED_IMAGE_MIMES,
  REVIEW_ALLOWED_VIDEO_MIMES,
  REVIEW_CONSTANTS,
} from '../review.constants';

export function validateReviewMediaItem(mimeType: string, sizeBytes?: number): 'IMAGE' | 'VIDEO' {
  if (!mimeType || mimeType.trim() === '') {
    throw new MediaEmptyFileException();
  }
  const normalized = mimeType.toLowerCase().trim();
  const isVideo = normalized.startsWith('video/');
  const allowed = isVideo ? REVIEW_ALLOWED_VIDEO_MIMES : REVIEW_ALLOWED_IMAGE_MIMES;
  if (!allowed[normalized]) {
    throw new MediaUnsupportedTypeException(mimeType);
  }
  if (sizeBytes !== undefined && sizeBytes !== null) {
    if (sizeBytes <= 0) throw new MediaEmptyFileException();
    const maxBytes = isVideo
      ? REVIEW_CONSTANTS.MAX_VIDEO_SIZE_BYTES
      : REVIEW_CONSTANTS.MAX_IMAGE_SIZE_BYTES;
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    if (sizeBytes > maxBytes) {
      throw new MediaFileTooLargeException(maxMb);
    }
  }
  return isVideo ? 'VIDEO' : 'IMAGE';
}

export function reviewExtensionForMime(mimeType: string, fileName?: string): string {
  const normalized = mimeType.toLowerCase().trim();
  const map = normalized.startsWith('video/')
    ? REVIEW_ALLOWED_VIDEO_MIMES
    : REVIEW_ALLOWED_IMAGE_MIMES;
  if (map[normalized]) return map[normalized];
  if (fileName?.includes('.')) {
    const ext = fileName.split('.').pop();
    if (ext) return ext.toLowerCase();
  }
  return 'bin';
}
