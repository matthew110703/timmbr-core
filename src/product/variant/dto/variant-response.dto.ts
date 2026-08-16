import { VariantStatus } from '@prisma/client';

export class VariantResponseDto {
  id!: string;
  productId!: string;
  sku!: string;
  price!: number;
  isDefault!: boolean;
  status!: VariantStatus;
  currency!: string;
  compareAtPrice!: number | null;
  createdAt!: Date;
  updatedAt!: Date;
}
