import { APP_ROUTES } from '@/app.routes';
import { Public, ResponseMessage } from '@/common/decorators';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { BrandService } from '../brand.service';
import { GetBrandsQueryDto } from '../dto/get-brands-query.dto';
import { BRAND_ROUTES } from '../brand.routes';

@Controller(APP_ROUTES.BRANDS)
export class BrandController {
  constructor(private readonly service: BrandService) {}

  @Get()
  @Public()
  @ResponseMessage('Brands fetched successfully.')
  getAll(@Query() query: GetBrandsQueryDto) {
    return this.service.getAllBrands(query, true);
  }

  @Get(BRAND_ROUTES.BY_ID)
  @Public()
  @ResponseMessage('Brand fetched successfully.')
  getBrandById(@Param('brandId') brandId: string) {
    return this.service.getBrandById(brandId, true);
  }
}
