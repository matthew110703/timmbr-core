import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { STORAGE_PROVIDER } from './interfaces/storage-provider.interface';
import type { StorageProvider, UploadResult } from './interfaces/storage-provider.interface';
import { UploadedFile } from './interfaces/uploaded-file.interface';
import { UploadMediaDto } from './dto/upload-media.dto';
import { getExtensionForMime, validateMediaFile } from './common/media-validation.util';

export interface MediaUploadResponse {
  key: string;
  url: string;
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {}

  async upload(file: UploadedFile, options?: UploadMediaDto): Promise<MediaUploadResponse> {
    validateMediaFile(file);

    const extension = getExtensionForMime(file.mimetype, file.originalname);
    const uniqueId = randomUUID();
    const folder = options?.folder ? options.folder.replace(/^\/+|\/+$/g, '').trim() : '';
    const key = folder ? `${folder}/${uniqueId}.${extension}` : `${uniqueId}.${extension}`;

    const result: UploadResult = await this.storageProvider.upload(file.buffer, {
      key,
      folder,
      contentType: file.mimetype,
    });

    const url = this.getPublicUrl(result.key);

    return {
      key: result.key,
      url,
    };
  }

  async delete(key: string): Promise<void> {
    await this.storageProvider.delete(key);
  }

  getPublicUrl(key: string): string {
    return this.storageProvider.getPublicUrl(key);
  }
}
