import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage, Roles } from '@/common/decorators';
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CreatePageDto } from '../dto/create-page.dto';
import { GetPageQueryDto } from '../dto/get-page-query.dto';
import { UpsertPageDto } from '../dto/upsert-page.dto';
import { PAGE_ROUTES } from '../page.routes';
import { PageService } from '../page.service';

@Controller(`${APP_ROUTES.PREFIX.ADMIN}/${APP_ROUTES.PAGES}`)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class PageAdminController {
  constructor(private readonly service: PageService) {}

  @Get()
  @ResponseMessage('Pages fetched successfully.')
  getAll() {
    return this.service.listPages();
  }

  @Get(PAGE_ROUTES.BY_SLUG)
  @ResponseMessage('Page fetched successfully.')
  getPageBySlug(@Param('slug') slug: string, @Query() query: GetPageQueryDto) {
    return this.service.getPageBySlug(slug, query.section, false);
  }

  @Post()
  @HttpCode(201)
  @ResponseMessage('Page created successfully.')
  create(@Body() dto: CreatePageDto) {
    return this.service.createPage(dto);
  }

  @Put(PAGE_ROUTES.BY_SLUG)
  @HttpCode(200)
  @ResponseMessage('Page updated successfully.')
  upsertPage(@Param('slug') slug: string, @Body() dto: UpsertPageDto) {
    return this.service.upsertPage(slug, dto);
  }

  @Delete(PAGE_ROUTES.BY_SLUG)
  @HttpCode(200)
  @ResponseMessage('Page deleted successfully.')
  deletePage(@Param('slug') slug: string) {
    return this.service.deletePage(slug);
  }
}
