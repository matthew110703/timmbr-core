import { ProductStatus } from '@prisma/client';
import {
  ProductAttributeSpecification,
  VariantOptionGroup,
} from '../attribute/types/attribute.types';
import { VariantResponseDto } from '../variant/dto/variant-response.dto';

export class ProductCoverImageDto {
  id!: string;
  url!: string;
  altText!: string | null;
}

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
  price?: number | null;
  compareAtPrice?: number | null;
  currency?: string | null;
  hasMultipleVariants?: boolean;
  coverImage?: ProductCoverImageDto | null;
  attributes?: ProductAttributeSpecification[];
  variantOptions?: VariantOptionGroup[];
  variants?: VariantResponseDto[];
  createdAt!: Date;
  updatedAt!: Date;
}
