import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage, Roles } from '@/common/decorators';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { BrandService } from '../brand.service';
import { GetBrandsQueryDto } from '../dto/get-brands-query.dto';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { BRAND_ROUTES } from '../brand.routes';

@Controller(`${APP_ROUTES.PREFIX.ADMIN}/${APP_ROUTES.BRANDS}`)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class BrandAdminController {
  constructor(private readonly service: BrandService) {}

  @Get()
  @ResponseMessage('Brands fetched successfully.')
  getAll(@Query() query: GetBrandsQueryDto) {
    return this.service.getAllBrands(query);
  }

  @Get(BRAND_ROUTES.BY_ID)
  @ResponseMessage('Brand fetched successfully.')
  getBrandById(@Param('brandId') brandId: string) {
    return this.service.getBrandById(brandId);
  }

  @Patch(BRAND_ROUTES.BY_ID)
  @HttpCode(200)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @ResponseMessage('Brand updated successfully.')
  update(@Param('brandId') brandId: string, @Body() dto: UpdateBrandDto) {
    return this.service.update(brandId, dto);
  }

  @Post()
  @HttpCode(201)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @ResponseMessage('Brand added successfully.')
  create(@Body() dto: CreateBrandDto) {
    return this.service.create(dto);
  }

  @Delete(BRAND_ROUTES.BY_ID)
  @HttpCode(200)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @ResponseMessage('Brand deleted successfully.')
  delete(@Param('brandId') brandId: string) {
    return this.service.delete(brandId);
  }
}
