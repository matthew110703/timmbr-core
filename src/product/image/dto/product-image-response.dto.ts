export class ProductImageResponseDto {
  id!: string;
  productId!: string;
  variantId!: string | null;
  storageKey!: string;
  url!: string;
  altText!: string | null;
  sortOrder!: number;
  isPrimary!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
