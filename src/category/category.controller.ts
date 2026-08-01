import { Public, ResponseMessage } from '@/decorators';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { CategoryService } from './category.service';
import { GetCategoriesQueryDto } from './dto/get-categories-query.dto';

@Controller('categories')
export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  @Get()
  @Public()
  @ResponseMessage('Categories fetched successfully.')
  getAll(@Query() query: GetCategoriesQueryDto) {
    return this.service.getAllCategories(query);
  }

  @Get('tree/:parentId')
  @Public()
  @ResponseMessage('Category tree fetched successfully.')
  getTree(@Param('parentId') parentId?: string) {
    return this.service.getCategoryTree(parentId);
  }

  @Get(':catId')
  @Public()
  @ResponseMessage('Category fetched successfully.')
  getCategoryById(@Param('catId') catId: string) {
    return this.service.getCategoryById(catId);
  }
}
