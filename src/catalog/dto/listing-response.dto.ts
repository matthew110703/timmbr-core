import { FilterDisplay } from '@prisma/client';
import { CategoryListingContextDto } from '@/category/dto/category-listing-context.dto';
import { ListingSort } from '../listing/listing.types';

export class ListingCoverImageDto {
  url!: string;
  alt!: string | null;
}

/** What a product card needs. */
export class ListingProductDto {
  id!: string;
  slug!: string;
  title!: string;
  brandName!: string | null;
  price!: number;
  compareAtPrice!: number | null;
  currency!: string;
  discountPct!: number;
  hasMultipleVariants!: boolean;
  inStock!: boolean;
  /** The variant the price is for: what the card's wishlist heart saves. */
  defaultVariantId!: string | null;
  coverImage!: ListingCoverImageDto | null;
}

export class ListingFacetOptionDto {
  /** URL value (option or brand slug). */
  value!: string;
  label!: string;
  swatchHex?: string | null;
  /** Products this option would show, given the other selected groups. */
  count!: number;
  selected!: boolean;
}

export class ListingFacetDto {
  /** URL key ("material", "brand"…). */
  key!: string;
  label!: string;
  displayType!: FilterDisplay;
  options!: ListingFacetOptionDto[];
  /** True when only the top options (and selected ones) are returned. */
  truncated!: boolean;
}

export class ListingPriceDto {
  /** Slider bounds, snapped to `step`. */
  min!: number;
  max!: number;
  step!: number;
  selectedMin?: number;
  selectedMax?: number;
}

/** The request as understood: unknown keys and values dropped, everything in canonical order. */
export class ListingAppliedDto {
  filters!: string;
  priceMin?: number;
  priceMax?: number;
  sort!: ListingSort;
  q?: string;
}

export class ListingFacetsResponseDto {
  total!: number;
  facets!: ListingFacetDto[];
  price!: ListingPriceDto;
  applied!: ListingAppliedDto;
}

/** Header search typeahead. */
export class SearchSuggestResponseDto {
  products!: ListingProductDto[];
}

export class ListingResponseDto extends ListingFacetsResponseDto {
  category!: CategoryListingContextDto | null;
  products!: ListingProductDto[];
  page!: number;
  limit!: number;
  totalPages!: number;
}
