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
  brand?: { id: string; name: string; slug?: string } | null;
  categoryId!: string;
  category?: { id: string; name: string; slug?: string } | null;
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
