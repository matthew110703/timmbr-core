export const ATTRIBUTE_ROUTES = {
  DEFINITIONS: {
    ROOT: '',
    BY_ID: ':id',
  },
  PRODUCT_ASSIGNMENTS: {
    ROOT: ':productId/attributes',
    BY_DEFINITION: ':productId/attributes/:definitionId',
  },
  VARIANT_ASSIGNMENTS: {
    ROOT: ':productId/variants/:variantId/attributes',
    BY_DEFINITION: ':productId/variants/:variantId/attributes/:definitionId',
  },
} as const;
