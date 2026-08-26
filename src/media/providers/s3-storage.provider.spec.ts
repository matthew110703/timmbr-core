import { Test, TestingModule } from '@nestjs/testing';
import { S3StorageProvider } from './s3-storage.provider';
import { MediaStorageException } from '@/common/exceptions/media.exception';

const mockSend = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: jest.fn().mockImplementation((args: unknown) => args),
    DeleteObjectCommand: jest.fn().mockImplementation((args: unknown) => args),
    HeadObjectCommand: jest.fn().mockImplementation((args: unknown) => args),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => {
  return {
    getSignedUrl: (...args: unknown[]): Promise<unknown> =>
      mockGetSignedUrl(...args) as Promise<unknown>,
  };
});

jest.mock('@/config/env', () => ({
  env: {
    STORAGE_ENDPOINT: 'https://r2.cloudflarestorage.com',
    STORAGE_REGION: 'auto',
    STORAGE_ACCESS_KEY_ID: 'test-key',
    STORAGE_SECRET_ACCESS_KEY: 'test-secret',
    STORAGE_BUCKET: 'timmbr-media',
    STORAGE_PUBLIC_URL: 'https://cdn.timmbr.com',
  },
}));

describe('S3StorageProvider', () => {
  let provider: S3StorageProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [S3StorageProvider],
    }).compile();

    provider = module.get<S3StorageProvider>(S3StorageProvider);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getPresignedUploadUrl', () => {
    it('successfully generates presigned URL with key and expiration', async () => {
      mockGetSignedUrl.mockResolvedValueOnce(
        'https://signed-url.example.com/products/123/image.webp',
      );

      const result = await provider.getPresignedUploadUrl({
        key: 'products/123/image.webp',
        contentType: 'image/webp',
        expiresInSeconds: 600,
      });

      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        uploadUrl: 'https://signed-url.example.com/products/123/image.webp',
        key: 'products/123/image.webp',
        expiresIn: 600,
      });
    });

    it('uses default expiration time when expiresInSeconds is not specified', async () => {
      mockGetSignedUrl.mockResolvedValueOnce(
        'https://signed-url.example.com/products/123/image.webp',
      );

      const result = await provider.getPresignedUploadUrl({
        key: 'products/123/image.webp',
        contentType: 'image/webp',
      });

      expect(result.expiresIn).toBe(300);
      expect(result.uploadUrl).toBe('https://signed-url.example.com/products/123/image.webp');
    });

    it('throws MediaStorageException when key is missing', async () => {
      await expect(
        provider.getPresignedUploadUrl({ key: '', contentType: 'image/webp' }),
      ).rejects.toThrow(MediaStorageException);
    });

    it('throws MediaStorageException when getSignedUrl fails', async () => {
      mockGetSignedUrl.mockRejectedValueOnce(new Error('Presigner signing failure'));

      await expect(
        provider.getPresignedUploadUrl({
          key: 'test.webp',
          contentType: 'image/webp',
        }),
      ).rejects.toThrow(MediaStorageException);
    });
  });

  describe('exists', () => {
    it('returns true when object exists in storage', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await provider.exists('products/123/image.webp');

      expect(mockSend).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('returns false when empty key is provided', async () => {
      const result = await provider.exists('');
      expect(result).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('returns false when storage returns NotFound error', async () => {
      const notFoundError = new Error('Not Found');
      notFoundError.name = 'NotFound';
      mockSend.mockRejectedValueOnce(notFoundError);

      const result = await provider.exists('products/123/missing.webp');

      expect(result).toBe(false);
    });

    it('returns false when storage returns 404 httpStatusCode', async () => {
      const error404 = {
        name: 'NoSuchKey',
        $metadata: { httpStatusCode: 404 },
      };
      mockSend.mockRejectedValueOnce(error404);

      const result = await provider.exists('products/123/missing.webp');

      expect(result).toBe(false);
    });

    it('throws MediaStorageException on other storage failures', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'));

      await expect(provider.exists('products/123/image.webp')).rejects.toThrow(
        MediaStorageException,
      );
    });
  });

  describe('delete', () => {
    it('successfully deletes file by key', async () => {
      mockSend.mockResolvedValueOnce({});

      await provider.delete('products/123/image.webp');

      expect(mockSend).toHaveBeenCalled();
    });

    it('throws MediaStorageException when s3 client delete fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('S3 delete error'));

      await expect(provider.delete('products/123/image.webp')).rejects.toThrow(
        MediaStorageException,
      );
    });
  });

  describe('getPublicUrl', () => {
    it('constructs public URL using STORAGE_PUBLIC_URL', () => {
      const url = provider.getPublicUrl('products/123/image.webp');
      expect(url).toBe('https://cdn.timmbr.com/products/123/image.webp');
    });

    it('handles leading slashes in key gracefully', () => {
      const url = provider.getPublicUrl('/products/123/image.webp');
      expect(url).toBe('https://cdn.timmbr.com/products/123/image.webp');
    });
  });
});
