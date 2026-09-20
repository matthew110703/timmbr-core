import { APP_ROUTES } from '@/app.routes';
import { Public, ResponseMessage } from '@/common/decorators';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { GetPageQueryDto } from '../dto/get-page-query.dto';
import { PAGE_ROUTES } from '../page.routes';
import { PageService } from '../page.service';

@Controller(APP_ROUTES.PAGES)
export class PageController {
  constructor(private readonly service: PageService) {}

  @Get(PAGE_ROUTES.BY_SLUG)
  @Public()
  @ResponseMessage('Page content fetched successfully.')
  getPageBySlug(@Param('slug') slug: string, @Query() query: GetPageQueryDto) {
    return this.service.getPageBySlug(slug, query.section, true);
  }
}
