import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage, Roles } from '@/common/decorators';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { VariantService } from '../variant.service';
import { CreateVariantDto } from '../dto/create-variant.dto';
import { UpdateVariantDto } from '../dto/update-variant.dto';
import { GetVariantsQueryDto } from '../dto/get-variants-query.dto';
import { VARIANT_ROUTES } from '../variant.routes';

@Controller(`${APP_ROUTES.PREFIX.ADMIN}/${APP_ROUTES.PRODUCTS}`)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class VariantAdminController {
  constructor(private readonly service: VariantService) {}

  @Get(VARIANT_ROUTES.LIST)
  @ResponseMessage('Variants fetched successfully.')
  getAll(@Param('productId') productId: string, @Query() query: GetVariantsQueryDto) {
    return this.service.getAllVariants(productId, query);
  }

  @Get(VARIANT_ROUTES.BY_ID)
  @ResponseMessage('Variant fetched successfully.')
  getVariantById(@Param('productId') productId: string, @Param('variantId') variantId: string) {
    return this.service.getVariantById(productId, variantId);
  }

  @Post(VARIANT_ROUTES.LIST)
  @HttpCode(201)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @ResponseMessage('Variant added successfully.')
  create(@Param('productId') productId: string, @Body() dto: CreateVariantDto) {
    return this.service.create(productId, dto);
  }

  @Patch(VARIANT_ROUTES.BY_ID)
  @HttpCode(200)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @ResponseMessage('Variant updated successfully.')
  patch(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.service.update(productId, variantId, dto);
  }

  @Put(VARIANT_ROUTES.BY_ID)
  @HttpCode(200)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @ResponseMessage('Variant updated successfully.')
  put(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.service.update(productId, variantId, dto);
  }
}
