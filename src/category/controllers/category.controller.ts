import { APP_ROUTES } from '@/app.routes';
import { Public, ResponseMessage } from '@/common/decorators';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { CategoryService } from '../category.service';
import { GetCategoriesQueryDto } from '../dto/get-categories-query.dto';
import { CATEGORY_ROUTES } from '../category.routes';

@Controller(APP_ROUTES.CATEGORIES)
export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  @Get()
  @Public()
  @ResponseMessage('Categories fetched successfully.')
  getAll(@Query() query: GetCategoriesQueryDto) {
    return this.service.getAllCategories(query);
  }

  @Get(CATEGORY_ROUTES.TREE)
  @Public()
  @ResponseMessage('Category tree fetched successfully.')
  getTree(@Param('parentId') parentId?: string) {
    return this.service.getCategoryTree(parentId);
  }

  @Get(CATEGORY_ROUTES.BY_ID)
  @Public()
  @ResponseMessage('Category fetched successfully.')
  getCategoryById(@Param('catId') catId: string) {
    return this.service.getCategoryById(catId);
  }
}
