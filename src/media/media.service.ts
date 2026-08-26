import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { STORAGE_PROVIDER } from './interfaces/storage-provider.interface';
import type { StorageProvider } from './interfaces/storage-provider.interface';
import { GeneratePresignedUrlsDto, PresignedUrlItemDto } from './dto/generate-presigned-url.dto';
import { getExtensionForMime, validateMediaItem } from './common/media-validation.util';

export interface PresignedUrlItemResponse {
  fileName: string;
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
}

export interface GeneratePresignedUrlsResponse {
  files: PresignedUrlItemResponse[];
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {}

  async getPresignedUploadUrls(
    dto: GeneratePresignedUrlsDto,
  ): Promise<GeneratePresignedUrlsResponse> {
    const folder = dto.folder ? dto.folder.replace(/^\/+|\/+$/g, '').trim() : '';

    const files = await Promise.all(
      dto.files.map((item) => this.generateSinglePresignedUrl(item, folder)),
    );

    return { files };
  }

  private async generateSinglePresignedUrl(
    item: PresignedUrlItemDto,
    folder: string,
  ): Promise<PresignedUrlItemResponse> {
    validateMediaItem({
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
    });

    const extension = getExtensionForMime(item.mimeType, item.fileName);
    const uniqueId = randomUUID();
    const key = folder ? `${folder}/${uniqueId}.${extension}` : `${uniqueId}.${extension}`;

    const presigned = await this.storageProvider.getPresignedUploadUrl({
      key,
      contentType: item.mimeType,
    });

    const publicUrl = this.getPublicUrl(key);

    return {
      fileName: item.fileName,
      key: presigned.key,
      uploadUrl: presigned.uploadUrl,
      publicUrl,
      expiresIn: presigned.expiresIn,
    };
  }

  async delete(key: string): Promise<void> {
    await this.storageProvider.delete(key);
  }

  getPublicUrl(key: string): string {
    return this.storageProvider.getPublicUrl(key);
  }
}
