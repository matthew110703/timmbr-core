export interface UploadOptions {
  folder?: string;
  contentType?: string;
  key?: string;
}

export interface UploadResult {
  key: string;
}

export interface StorageProvider {
  upload(file: Buffer, options: UploadOptions): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
