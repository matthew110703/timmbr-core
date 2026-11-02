export interface PresignedUploadOptions {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export interface PutBufferOptions {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface PresignedDownloadOptions {
  key: string;
  downloadFileName?: string;
  responseContentType?: string;
  expiresInSeconds?: number;
}

export interface PresignedDownloadResult {
  downloadUrl: string;
  key: string;
  expiresIn: number;
}

export interface StorageProvider {
  getPresignedUploadUrl(options: PresignedUploadOptions): Promise<PresignedUploadResult>;
  getPresignedDownloadUrl(options: PresignedDownloadOptions): Promise<PresignedDownloadResult>;
  putBuffer(options: PutBufferOptions): Promise<void>;
  getBuffer(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
