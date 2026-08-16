import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage, Roles } from '@/common/decorators';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ProductService } from '../product.service';
import { GetProductsQueryDto } from '../dto/get-products-query.dto';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { PRODUCT_ROUTES } from '../product.routes';

@Controller(`${APP_ROUTES.PREFIX.ADMIN}/${APP_ROUTES.PRODUCTS}`)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class ProductAdminController {
  constructor(private readonly service: ProductService) {}

  @Get()
  @ResponseMessage('Products fetched successfully.')
  getAll(@Query() query: GetProductsQueryDto) {
    return this.service.getAllProducts(query);
  }

  @Get(PRODUCT_ROUTES.BY_ID)
  @ResponseMessage('Product fetched successfully.')
  getProductById(@Param('productId') productId: string) {
    return this.service.getProductById(productId);
  }

  @Patch(PRODUCT_ROUTES.BY_ID)
  @HttpCode(200)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @ResponseMessage('Product updated successfully.')
  update(@Param('productId') productId: string, @Body() dto: UpdateProductDto) {
    return this.service.update(productId, dto);
  }

  @Post()
  @HttpCode(201)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @ResponseMessage('Product added successfully.')
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Delete(PRODUCT_ROUTES.BY_ID)
  @HttpCode(200)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @ResponseMessage('Product deleted successfully.')
  delete(@Param('productId') productId: string) {
    return this.service.delete(productId);
  }
}
