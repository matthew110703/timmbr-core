import { Module } from '@nestjs/common';
import { AdminUserController } from './user/user.controller';
import { AdminUserService } from './user/user.service';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';

@Module({
  controllers: [AdminUserController, CategoriesController],
  providers: [AdminUserService, CategoriesService],
})
export class AdminModule {}
