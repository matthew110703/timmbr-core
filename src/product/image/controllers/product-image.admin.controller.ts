import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage, Roles } from '@/common/decorators';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ProductImageService } from '../product-image.service';
import { PresignProductImagesDto } from '../dto/presign-product-images.dto';
import { CreateProductImagesDto } from '../dto/create-product-images.dto';
import { DeleteProductImagesDto } from '../dto/delete-product-images.dto';
import { GetProductImagesQueryDto } from '../dto/get-product-images-query.dto';
import { PRODUCT_IMAGE_ROUTES } from '../product-image.routes';

@Controller(`${APP_ROUTES.PREFIX.ADMIN}/${APP_ROUTES.PRODUCTS}`)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class ProductImageAdminController {
  constructor(private readonly service: ProductImageService) {}

  @Post(PRODUCT_IMAGE_ROUTES.PRESIGN)
  @HttpCode(200)
  @ResponseMessage('Presigned upload URL(s) generated successfully.')
  presign(@Param('productId') productId: string, @Body() dto: PresignProductImagesDto) {
    return this.service.presignUploadUrls(productId, dto);
  }

  @Post(PRODUCT_IMAGE_ROUTES.BASE)
  @HttpCode(201)
  @ResponseMessage('Product images registered successfully.')
  create(@Param('productId') productId: string, @Body() dto: CreateProductImagesDto) {
    return this.service.registerImages(productId, dto);
  }

  @Get(PRODUCT_IMAGE_ROUTES.BASE)
  @ResponseMessage('Product images fetched successfully.')
  getAll(@Param('productId') productId: string, @Query() query: GetProductImagesQueryDto) {
    return this.service.getImages(productId, query);
  }

  @Patch(PRODUCT_IMAGE_ROUTES.PRIMARY)
  @HttpCode(200)
  @ResponseMessage('Primary product image updated successfully.')
  setPrimary(@Param('productId') productId: string, @Param('imageId') imageId: string) {
    return this.service.setPrimaryImage(productId, imageId);
  }

  @Delete(PRODUCT_IMAGE_ROUTES.BASE)
  @HttpCode(200)
  @ResponseMessage('Product images deleted successfully.')
  delete(@Param('productId') productId: string, @Body() dto: DeleteProductImagesDto) {
    return this.service.deleteImages(productId, dto);
  }
}
