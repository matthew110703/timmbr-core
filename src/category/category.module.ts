import { Module } from '@nestjs/common';
import { CategoryController } from './controllers/category.controller';
import { CategoryAdminController } from './controllers/category.admin.controller';
import { CategoryService } from './category.service';
import { CategoryRepository } from './category.repository';

@Module({
  controllers: [CategoryController, CategoryAdminController],
  providers: [CategoryService, CategoryRepository],
  exports: [CategoryService, CategoryRepository],
})
export class CategoryModule {}
