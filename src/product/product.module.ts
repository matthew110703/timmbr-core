import { Module } from '@nestjs/common';
import { ProductRepository } from './product.repository';
import { ProductService } from './product.service';
import { ProductController } from './controllers/product.controller';
import { ProductAdminController } from './controllers/product.admin.controller';
import { VariantRepository } from './variant/variant.repository';
import { VariantService } from './variant/variant.service';
import { VariantController } from './variant/controllers/variant.controller';
import { VariantAdminController } from './variant/controllers/variant.admin.controller';
import { ProductImageRepository } from './image/product-image.repository';
import { ProductImageService } from './image/product-image.service';
import { ProductImageAdminController } from './image/controllers/product-image.admin.controller';
import { CategoryModule } from '@/category/category.module';
import { BrandModule } from '@/brand/brand.module';
import { MediaModule } from '@/media/media.module';

@Module({
  imports: [CategoryModule, BrandModule, MediaModule],
  controllers: [
    ProductController,
    ProductAdminController,
    VariantController,
    VariantAdminController,
    ProductImageAdminController,
  ],
  providers: [
    ProductRepository,
    ProductService,
    VariantRepository,
    VariantService,
    ProductImageRepository,
    ProductImageService,
  ],
  exports: [
    ProductService,
    ProductRepository,
    VariantService,
    VariantRepository,
    ProductImageService,
    ProductImageRepository,
  ],
})
export class ProductModule {}
