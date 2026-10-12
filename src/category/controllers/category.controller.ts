import { APP_ROUTES } from '@/app.routes';
import { Public, ResponseMessage } from '@/common/decorators';
import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { CategoryService } from '../category.service';
import { GetCategoriesQueryDto } from '../dto/get-categories-query.dto';
import { GetCategoryTreeQueryDto } from '../dto/get-category-tree-query.dto';
import { CATEGORY_ROUTES } from '../category.routes';

@Controller(APP_ROUTES.CATEGORIES)
export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  @Get()
  @Public()
  @ResponseMessage('Categories fetched successfully.')
  getAll(@Query() query: GetCategoriesQueryDto) {
    return this.service.getAllCategories(query, true);
  }

  // Declared before BY_ID so "tree" isn't read as a category ID.
  @Get(CATEGORY_ROUTES.TREE_ROOT)
  @Public()
  @Header('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=1200')
  @ResponseMessage('Category tree fetched successfully.')
  getRootTree(@Query() query: GetCategoryTreeQueryDto) {
    return this.service.getCategoryTree(undefined, true, query.depth);
  }

  @Get(CATEGORY_ROUTES.TREE)
  @Public()
  @ResponseMessage('Category tree fetched successfully.')
  getTree(@Param('parentId') parentId: string, @Query() query: GetCategoryTreeQueryDto) {
    return this.service.getCategoryTree(parentId, true, query.depth);
  }

  @Get(CATEGORY_ROUTES.BY_ID)
  @Public()
  @ResponseMessage('Category fetched successfully.')
  getCategoryById(@Param('catId') catId: string) {
    return this.service.getCategoryById(catId, true);
  }
}
