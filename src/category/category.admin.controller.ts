import { ResponseMessage, Roles } from '@/decorators';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CategoryService } from './category.service';
import { GetCategoriesQueryDto } from './dto/get-categories-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('admin/categories')
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class CategoryAdminController {
  constructor(private service: CategoryService) {}

  @Get()
  @ResponseMessage('Categories fetched successfully.')
  getAll(@Query() query: GetCategoriesQueryDto) {
    return this.service.getAllCategories(query);
  }

  @Get('tree/:parentId')
  @ResponseMessage('Category tree fetched successfully.')
  getTree(@Param('parentId') parentId?: string) {
    return this.service.getCategoryTree(parentId);
  }

  @Get(':catId')
  @ResponseMessage('Category fetched successfully')
  getCategoryById(@Param('catId') catId: string) {
    return this.service.getCategoryById(catId);
  }

  @Patch(':catId')
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

  @Delete(':catId')
  @HttpCode(200)
  @Roles(UserRole.MASTER, UserRole.ADMIN)
  @ResponseMessage('Category deleted successfully')
  delete(@Param('catId') catId: string) {
    return this.service.delete(catId);
  }
}
