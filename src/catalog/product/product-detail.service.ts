import { Injectable } from '@nestjs/common';
import { CategoryService } from '@/category/category.service';
import { CategoryNotFoundException } from '@/common/exceptions/category.exception';
import { ProductNotFoundException } from '@/common/exceptions/product.exception';
import { MediaService } from '@/media/media.service';
import { CatalogCache } from '../catalog-cache';
import { ProductDetailResponseDto } from '../dto/product-detail-response.dto';
import { ProductDetailMapper } from './product-detail.mapper';
import { ProductDetailRepository } from './product-detail.repository';

/** Price and stock on the page may lag catalog writes by up to this long; the cart rechecks. */
const PRODUCT_CACHE_TTL_SECONDS = 60;
/** Bump when the response shape changes, so old cached entries are never served. */
const CACHE_VERSION = 'v1';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The storefront product page: one cached payload with images, option groups, every variant's
 * price and stock, specs and the category breadcrumb. Not found (never cached) when the product,
 * all of its variants, or its category path isn't active.
 */
@Injectable()
export class ProductDetailService {
  constructor(
    private readonly repository: ProductDetailRepository,
    private readonly categoryService: CategoryService,
    private readonly mediaService: MediaService,
    private readonly cache: CatalogCache,
  ) {}

  async getBySlug(slug: string): Promise<ProductDetailResponseDto> {
    if (!SLUG.test(slug) || slug.length > 200) throw new ProductNotFoundException();
    return this.cache.get(`pdp:${CACHE_VERSION}:${slug}`, PRODUCT_CACHE_TTL_SECONDS, async () => {
      const row = await this.repository.findActiveBySlug(slug);
      if (!row || row.variants.length === 0) throw new ProductNotFoundException();

      const breadcrumb = await this.categoryService
        .getListingContext(row.category.slug)
        .then((context) => context.breadcrumb)
        .catch((error: unknown) => {
          // An inactive category path hides its products, as on the listing.
          if (error instanceof CategoryNotFoundException) throw new ProductNotFoundException();
          throw error;
        });

      return ProductDetailMapper.toResponse(row, breadcrumb, (key) =>
        this.mediaService.getPublicUrl(key),
      );
    });
  }
}
