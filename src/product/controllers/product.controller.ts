import { APP_ROUTES } from '@/app.routes';
import { Public, ResponseMessage } from '@/common/decorators';
import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ProductService } from '../product.service';
import { GetProductsQueryDto } from '../dto/get-products-query.dto';
import { PRODUCT_ROUTES } from '../product.routes';

@Controller(APP_ROUTES.PRODUCTS)
export class ProductController {
  constructor(private readonly service: ProductService) {}

  @Get()
  @Public()
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  @ResponseMessage('Products fetched successfully.')
  getAll(@Query() query: GetProductsQueryDto) {
    return this.service.getAllProducts(query, true);
  }

  /**
   * @deprecated Global and not scoped to a listing. Use `GET /catalog/listing/facets`, which
   * returns product counts for the current category and filters.
   */
  @Get(PRODUCT_ROUTES.FILTERS)
  @Public()
  @Header('Deprecation', 'true')
  @Header('Link', '</api/v1/catalog/listing/facets>; rel="successor-version"')
  @Header('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=1200')
  @ResponseMessage('Product filter options fetched successfully.')
  getFilters() {
    return this.service.getFilterMetadata();
  }

  @Get(PRODUCT_ROUTES.BY_SLUG)
  @Public()
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  @ResponseMessage('Product fetched successfully.')
  getProductBySlug(@Param('slug') slug: string) {
    return this.service.getProductBySlug(slug, true);
  }

  @Get(PRODUCT_ROUTES.BY_ID)
  @Public()
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  @ResponseMessage('Product fetched successfully.')
  getProductById(@Param('productId') productId: string) {
    return this.service.getProductById(productId, true);
  }
}
