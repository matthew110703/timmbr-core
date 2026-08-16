import {
  MediaEmptyFileException,
  MediaFileTooLargeException,
  MediaUnsupportedTypeException,
} from '@/common/exceptions/media.exception';
import { UploadedFile } from '../interfaces/uploaded-file.interface';

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export function validateMediaFile(file: UploadedFile): void {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new MediaEmptyFileException();
  }

  const normalizedMime = file.mimetype.toLowerCase();
  if (!ALLOWED_MIME_TYPES[normalizedMime]) {
    throw new MediaUnsupportedTypeException(file.mimetype);
  }

  const isVideo = normalizedMime.startsWith('video/');
  const maxBytes = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
  const maxMb = isVideo ? 50 : 10;

  if (file.size > maxBytes || file.buffer.length > maxBytes) {
    throw new MediaFileTooLargeException(maxMb);
  }
}

export function getExtensionForMime(mimetype: string, originalname?: string): string {
  const normalizedMime = mimetype.toLowerCase();
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
