import { VariantStatus } from '@prisma/client';

export type VariantAvailabilityStatus = 'IN_STOCK' | 'OUT_OF_STOCK' | 'DISCONTINUED' | 'HIDDEN';

export class VariantAvailabilityDto {
  status!: VariantAvailabilityStatus;
  quantity!: number;
}

export class VariantResponseDto {
  id!: string;
  productId!: string;
  sku!: string;
  price!: number;
  isDefault!: boolean;
  status!: VariantStatus;
  currency!: string;
  compareAtPrice!: number | null;
  availability!: VariantAvailabilityDto;
  createdAt!: Date;
  updatedAt!: Date;
}
