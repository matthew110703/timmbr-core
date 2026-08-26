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

export interface StorageProvider {
  getPresignedUploadUrl(options: PresignedUploadOptions): Promise<PresignedUploadResult>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
