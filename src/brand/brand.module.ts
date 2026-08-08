import { Module } from '@nestjs/common';
import { BrandRepository } from './brand.repository';
import { BrandService } from './brand.service';
import { BrandController } from './controllers/brand.controller';
import { BrandAdminController } from './controllers/brand.admin.controller';

@Module({
  controllers: [BrandController, BrandAdminController],
  providers: [BrandRepository, BrandService],
  exports: [BrandService, BrandRepository],
})
export class BrandModule {}
