import { APP_ROUTES } from '@/app.routes';
import { Public, ResponseMessage } from '@/common/decorators';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { VariantService } from '../variant.service';
import { GetVariantsQueryDto } from '../dto/get-variants-query.dto';
import { VARIANT_ROUTES } from '../variant.routes';

@Controller(APP_ROUTES.PRODUCTS)
export class VariantController {
  constructor(private readonly service: VariantService) {}

  @Get(VARIANT_ROUTES.LIST)
  @Public()
  @ResponseMessage('Variants fetched successfully.')
  getAll(@Param('productId') productId: string, @Query() query: GetVariantsQueryDto) {
    return this.service.getAllVariants(productId, query, true);
  }

  @Get(VARIANT_ROUTES.BY_ID)
  @Public()
  @ResponseMessage('Variant fetched successfully.')
  getVariantById(@Param('productId') productId: string, @Param('variantId') variantId: string) {
    return this.service.getVariantById(productId, variantId, true);
  }
}
