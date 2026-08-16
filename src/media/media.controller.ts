import { APP_ROUTES } from '@/app.routes';
import { ResponseMessage, Roles } from '@/common/decorators';
import { Controller, Delete, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { MediaService } from './media.service';
import { MediaKeyQueryDto } from './dto/media-key-query.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
import { UploadedFile } from './interfaces/uploaded-file.interface';
import { MediaEmptyFileException } from '@/common/exceptions/media.exception';
import { MEDIA_ROUTES } from './media.routes';

interface MultipartValue {
  value?: unknown;
}

@Controller(APP_ROUTES.MEDIA)
@Roles(UserRole.ADMIN, UserRole.MASTER)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post(MEDIA_ROUTES.UPLOAD)
  @HttpCode(201)
  @ResponseMessage('Media uploaded successfully.')
  async upload(@Req() req: FastifyRequest) {
    const isMultipart =
      typeof (req as { isMultipart?: () => boolean }).isMultipart === 'function'
        ? (req as { isMultipart: () => boolean }).isMultipart()
        : false;

    if (!isMultipart) {
      throw new MediaEmptyFileException();
    }

    const data = await (
      req as {
        file?: () => Promise<{
          toBuffer: () => Promise<Buffer>;
          mimetype: string;
          filename: string;
          fields?: Record<string, MultipartValue>;
        }>;
      }
    ).file?.();
    if (!data) {
      throw new MediaEmptyFileException();
    }

    const buffer = await data.toBuffer();
    const uploadedFile: UploadedFile = {
      buffer,
      mimetype: data.mimetype,
      size: buffer.length,
      originalname: data.filename,
    };

    const folderValue = data.fields?.folder?.value;

    const dto = new UploadMediaDto();
    if (typeof folderValue === 'string') {
      dto.folder = folderValue;
    }

    return this.mediaService.upload(uploadedFile, dto);
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
