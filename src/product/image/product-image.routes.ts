export const PRODUCT_IMAGE_ROUTES = {
  PRESIGN: ':productId/images/presign',
  BASE: ':productId/images',
  BY_ID: ':productId/images/:imageId',
  PRIMARY: ':productId/images/:imageId/primary',
} as const;
