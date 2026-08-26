import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage, Roles } from '@/common/decorators';
import { Body, Controller, Delete, Get, HttpCode, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MediaService } from './media.service';
import { MediaKeyQueryDto } from './dto/media-key-query.dto';
import { GeneratePresignedUrlsDto } from './dto/generate-presigned-url.dto';
import { MEDIA_ROUTES } from './media.routes';

@Controller(APP_ROUTES.MEDIA)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post(MEDIA_ROUTES.PRESIGNED_URL)
  @HttpCode(200)
  @ResponseMessage('Presigned upload URL(s) generated successfully.')
  generatePresignedUrls(@Body() dto: GeneratePresignedUrlsDto) {
    return this.mediaService.getPresignedUploadUrls(dto);
  }

  @Get(MEDIA_ROUTES.URL)
  @ResponseMessage('Media URL fetched successfully.')
  getUrl(@Query() query: MediaKeyQueryDto) {
    const url = this.mediaService.getPublicUrl(query.key);
    return { url };
  }

  @Delete()
  @HttpCode(200)
  @ResponseMessage('Media deleted successfully.')
  async delete(@Query() query: MediaKeyQueryDto) {
    await this.mediaService.delete(query.key);
    return { success: true };
  }
}
