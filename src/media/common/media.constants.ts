export const MEDIA_CONSTANTS = {
  MAX_BATCH_UPLOAD_LIMIT: 20,
  MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  MAX_VIDEO_SIZE_BYTES: 50 * 1024 * 1024, // 50MB
  MAX_IMAGE_SIZE_MB: 10,
  MAX_VIDEO_SIZE_MB: 50,
  DEFAULT_PRESIGNED_EXPIRATION_SECONDS: 300, // 5 minutes
} as const;

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};
