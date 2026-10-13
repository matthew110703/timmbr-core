import { Module } from '@nestjs/common';
import { CategoryModule } from '@/category/category.module';
import { MediaModule } from '@/media/media.module';
import { CatalogCache } from './catalog-cache';
import { CatalogController } from './catalog.controller';
import { FacetCatalogService } from './facet-catalog.service';
import { ListingRepository } from './listing.repository';
import { ListingService } from './listing.service';
import { ProductDetailRepository } from './product/product-detail.repository';
import { ProductDetailService } from './product/product-detail.service';

/** Storefront catalog reads: the listing (PLP), search suggestions and the product page. */
@Module({
  imports: [CategoryModule, MediaModule],
  controllers: [CatalogController],
  providers: [
    ListingService,
    ListingRepository,
    FacetCatalogService,
    CatalogCache,
    ProductDetailService,
    ProductDetailRepository,
  ],
})
export class CatalogModule {}
