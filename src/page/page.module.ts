import { Module } from '@nestjs/common';
import { PageAdminController } from './controllers/page.admin.controller';
import { PageController } from './controllers/page.controller';
import { PageRepository } from './page.repository';
import { PageService } from './page.service';

@Module({
  controllers: [PageController, PageAdminController],
  providers: [PageService, PageRepository],
  exports: [PageService],
})
export class PageModule {}
