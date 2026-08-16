import { ProductStatus } from '@prisma/client';

export class ProductResponseDto {
  id!: string;
  title!: string;
  slug!: string;
  description!: string | null;
  shortDescription!: string;
  status!: ProductStatus;
  hsnCode!: string | null;
  gstRate!: number;
  brandId!: string | null;
  categoryId!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
