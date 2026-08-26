import { Injectable, Logger } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/config/env';
import {
  PresignedUploadOptions,
  PresignedUploadResult,
  StorageProvider,
} from '../interfaces/storage-provider.interface';
import {
  MediaMissingConfigException,
  MediaStorageException,
} from '@/common/exceptions/media.exception';
import { MEDIA_CONSTANTS } from '../common/media.constants';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    this.bucket = env.STORAGE_BUCKET ?? '';
    this.publicUrl = env.STORAGE_PUBLIC_URL ?? '';

    this.client = new S3Client({
      endpoint: env.STORAGE_ENDPOINT,
      region: env.STORAGE_REGION ?? 'auto',
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY_ID ?? '',
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  async getPresignedUploadUrl(options: PresignedUploadOptions): Promise<PresignedUploadResult> {
    if (!this.bucket) {
      throw new MediaMissingConfigException('STORAGE_BUCKET is not configured.');
    }

    if (!options.key) {
      throw new MediaStorageException('Storage key is required for presigned URL generation.');
    }

    const expiresIn =
      options.expiresInSeconds ?? MEDIA_CONSTANTS.DEFAULT_PRESIGNED_EXPIRATION_SECONDS;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: options.key,
        ContentType: options.contentType,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      const uploadUrl = await getSignedUrl(this.client as any, command, { expiresIn });

      return {
        uploadUrl,
        key: options.key,
        expiresIn,
      };
    } catch (error) {
      this.logger.error(`Failed to generate presigned upload URL for key: ${options.key}`, error);
      throw new MediaStorageException('Failed to generate presigned upload URL.');
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.bucket) {
      throw new MediaMissingConfigException('STORAGE_BUCKET is not configured.');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
    } catch (error) {
      this.logger.error(`Failed to delete object from S3/R2 with key: ${key}`, error);
      throw new MediaStorageException('Failed to delete file from storage.');
    }
  }

  getPublicUrl(key: string): string {
    const cleanKey = key.replace(/^\/+/, '');
    if (this.publicUrl) {
      const base = this.publicUrl.replace(/\/+$/, '');
      return `${base}/${cleanKey}`;
    }

    if (env.STORAGE_ENDPOINT && this.bucket) {
      const endpoint = env.STORAGE_ENDPOINT.replace(/\/+$/, '');
      return `${endpoint}/${this.bucket}/${cleanKey}`;
    }

    return cleanKey;
  }
}
