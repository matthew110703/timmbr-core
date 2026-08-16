import { Module } from '@nestjs/common';
import { ProductRepository } from './product.repository';
import { ProductService } from './product.service';
import { ProductController } from './controllers/product.controller';
import { ProductAdminController } from './controllers/product.admin.controller';
import { VariantRepository } from './variant/variant.repository';
import { VariantService } from './variant/variant.service';
import { VariantController } from './variant/controllers/variant.controller';
import { VariantAdminController } from './variant/controllers/variant.admin.controller';
import { CategoryModule } from '@/category/category.module';
import { BrandModule } from '@/brand/brand.module';

@Module({
  imports: [CategoryModule, BrandModule],
  controllers: [
    ProductController,
    ProductAdminController,
    VariantController,
    VariantAdminController,
  ],
  providers: [ProductRepository, ProductService, VariantRepository, VariantService],
  exports: [ProductService, ProductRepository, VariantService, VariantRepository],
})
export class ProductModule {}
