export const REVIEW_CONSTANTS = {
  TITLE_MAX_LENGTH: 120,
  COMMENT_MAX_LENGTH: 10_000,
  MAX_IMAGES: 5,
  MAX_VIDEOS: 2,
  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024,
  MAX_VIDEO_SIZE_BYTES: 25 * 1024 * 1024,
  MAX_IMAGE_DIMENSION: 4096,
  THUMBNAIL_MAX_WIDTH: 400,
} as const;

export const REVIEW_ALLOWED_IMAGE_MIMES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const REVIEW_ALLOWED_VIDEO_MIMES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

export const REVIEW_WRITE_THROTTLE = { default: { limit: 10, ttl: 60_000 } };
export const REVIEW_VOTE_THROTTLE = { default: { limit: 30, ttl: 60_000 } };
