import {
  MediaEmptyFileException,
  MediaFileTooLargeException,
  MediaUnsupportedTypeException,
} from '@/common/exceptions/media.exception';
import { ALLOWED_MIME_TYPES, MEDIA_CONSTANTS } from './media.constants';

export { ALLOWED_MIME_TYPES, MEDIA_CONSTANTS };

export interface ValidateMediaItemParams {
  mimeType: string;
  sizeBytes?: number;
}

export function validateMediaItem(item: ValidateMediaItemParams): void {
  if (!item.mimeType || item.mimeType.trim() === '') {
    throw new MediaEmptyFileException();
  }

  const normalizedMime = item.mimeType.toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES[normalizedMime]) {
    throw new MediaUnsupportedTypeException(item.mimeType);
  }

  if (item.sizeBytes !== undefined && item.sizeBytes !== null) {
    if (item.sizeBytes <= 0) {
      throw new MediaEmptyFileException();
    }

    const isVideo = normalizedMime.startsWith('video/');
    const maxBytes = isVideo
      ? MEDIA_CONSTANTS.MAX_VIDEO_SIZE_BYTES
      : MEDIA_CONSTANTS.MAX_IMAGE_SIZE_BYTES;
    const maxMb = isVideo ? MEDIA_CONSTANTS.MAX_VIDEO_SIZE_MB : MEDIA_CONSTANTS.MAX_IMAGE_SIZE_MB;

    if (item.sizeBytes > maxBytes) {
      throw new MediaFileTooLargeException(maxMb);
    }
  }
}

export function getExtensionForMime(mimetype: string, originalname?: string): string {
  const normalizedMime = mimetype.toLowerCase().trim();
  if (ALLOWED_MIME_TYPES[normalizedMime]) {
    return ALLOWED_MIME_TYPES[normalizedMime];
  }

  if (originalname && originalname.includes('.')) {
    const ext = originalname.split('.').pop();
    if (ext) {
      return ext.toLowerCase();
    }
  }

  return 'bin';
}
