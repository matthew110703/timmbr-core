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
import { AttributeDefinitionRepository } from './attribute/repositories/attribute-definition.repository';
import { AttributeValueRepository } from './attribute/repositories/attribute-value.repository';
import { AttributeDefinitionService } from './attribute/services/attribute-definition.service';
import { AttributeValueService } from './attribute/services/attribute-value.service';
import { AttributeDefinitionAdminController } from './attribute/controllers/attribute-definition.admin.controller';
import { ProductAttributeAdminController } from './attribute/controllers/product-attribute.admin.controller';
import { VariantAttributeAdminController } from './attribute/controllers/variant-attribute.admin.controller';
import { ProductCacheService } from './cache/product-cache.service';
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
    AttributeDefinitionAdminController,
    ProductAttributeAdminController,
    VariantAttributeAdminController,
  ],
  providers: [
    ProductCacheService,
    ProductRepository,
    ProductService,
    VariantRepository,
    VariantService,
    ProductImageRepository,
    ProductImageService,
    AttributeDefinitionRepository,
    AttributeValueRepository,
    AttributeDefinitionService,
    AttributeValueService,
  ],
  exports: [
    ProductCacheService,
    ProductService,
    ProductRepository,
    VariantService,
    VariantRepository,
    ProductImageService,
    ProductImageRepository,
    AttributeDefinitionService,
    AttributeValueService,
    AttributeDefinitionRepository,
    AttributeValueRepository,
  ],
})
export class ProductModule {}
