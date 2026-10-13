import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { APP_ROUTES } from '@/app.routes';
import { Public, ResponseMessage, TrustedUnthrottled } from '@/common/decorators';
import { CATALOG_ROUTES } from './catalog.routes';
import { GetListingQueryDto } from './dto/get-listing-query.dto';
import { SearchSuggestQueryDto } from './dto/search-suggest-query.dto';
import { ListingService } from './listing.service';
import { ProductDetailService } from './product/product-detail.service';

const LISTING_CACHE_CONTROL = 'public, max-age=30, s-maxage=60, stale-while-revalidate=120';

@Controller(APP_ROUTES.CATALOG)
@Public()
@TrustedUnthrottled()
export class CatalogController {
  constructor(
    private readonly listing: ListingService,
    private readonly productDetail: ProductDetailService,
  ) {}

  @Get(CATALOG_ROUTES.LISTING)
  @Header('Cache-Control', LISTING_CACHE_CONTROL)
  @ResponseMessage('Listing fetched successfully.')
  getListing(@Query() query: GetListingQueryDto) {
    return this.listing.getListing(query);
  }

  @Get(CATALOG_ROUTES.LISTING_FACETS)
  @Header('Cache-Control', LISTING_CACHE_CONTROL)
  @ResponseMessage('Listing facets fetched successfully.')
  getFacets(@Query() query: GetListingQueryDto) {
    return this.listing.getFacets(query);
  }

  @Get(CATALOG_ROUTES.SEARCH_SUGGEST)
  @Header('Cache-Control', LISTING_CACHE_CONTROL)
  @ResponseMessage('Search suggestions fetched successfully.')
  suggest(@Query() query: SearchSuggestQueryDto) {
    return this.listing.suggest(query);
  }

  @Get(CATALOG_ROUTES.PRODUCT)
  @Header('Cache-Control', LISTING_CACHE_CONTROL)
  @ResponseMessage('Product fetched successfully.')
  getProduct(@Param('slug') slug: string) {
    return this.productDetail.getBySlug(slug);
  }
}
