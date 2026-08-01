import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage, Roles } from '@/common/decorators';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CategoryService } from '../category.service';
import { GetCategoriesQueryDto } from '../dto/get-categories-query.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { DeleteCategoryQueryDto } from '../dto/delete-category-query.dto';
import { CATEGORY_ROUTES } from '../category.routes';

@Controller(`${APP_ROUTES.PREFIX.ADMIN}/${APP_ROUTES.CATEGORIES}`)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class CategoryAdminController {
  constructor(private service: CategoryService) {}

  @Get()
  @ResponseMessage('Categories fetched successfully.')
  getAll(@Query() query: GetCategoriesQueryDto) {
    return this.service.getAllCategories(query);
  }

  @Get(CATEGORY_ROUTES.TREE)
  @ResponseMessage('Category tree fetched successfully.')
  getTree(@Param('parentId') parentId?: string) {
    return this.service.getCategoryTree(parentId);
  }

  @Get(CATEGORY_ROUTES.BY_ID)
  @ResponseMessage('Category fetched successfully')
  getCategoryById(@Param('catId') catId: string) {
    return this.service.getCategoryById(catId);
  }

  @Patch(CATEGORY_ROUTES.BY_ID)
  @HttpCode(200)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @ResponseMessage('Category updated successfully')
  update(@Param('catId') catId: string, @Body() dto: UpdateCategoryDto) {
    return this.service.update(catId, dto);
  }

  @Post()
  @HttpCode(201)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @ResponseMessage('Category added successfully')
  create(@Body() dto: CreateCategoryDto) {
    return this.service.create(dto);
  }

  @Delete(CATEGORY_ROUTES.BY_ID)
  @HttpCode(200)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @ResponseMessage('Category deleted successfully')
  delete(@Param('catId') catId: string, @Query() query: DeleteCategoryQueryDto) {
    return this.service.delete(catId, query.force);
  }
}
