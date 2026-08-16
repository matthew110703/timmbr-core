import { Test, TestingModule } from '@nestjs/testing';
import { S3StorageProvider } from './s3-storage.provider';
import { MediaStorageException } from '@/common/exceptions/media.exception';

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: jest.fn().mockImplementation((args: unknown) => args),
    DeleteObjectCommand: jest.fn().mockImplementation((args: unknown) => args),
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

  describe('upload', () => {
    it('successfully uploads file and returns key', async () => {
      mockSend.mockResolvedValueOnce({});
      const buffer = Buffer.from('test-image-content');

      const result = await provider.upload(buffer, {
        key: 'products/123/image.webp',
        contentType: 'image/webp',
      });

      expect(mockSend).toHaveBeenCalled();
      expect(result).toEqual({ key: 'products/123/image.webp' });
    });

    it('throws MediaStorageException when key is missing', async () => {
      const buffer = Buffer.from('test');

      await expect(provider.upload(buffer, { key: '', contentType: 'image/webp' })).rejects.toThrow(
        MediaStorageException,
      );
    });

    it('throws MediaStorageException when s3 client send fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('S3 connection error'));
      const buffer = Buffer.from('test');

      await expect(
        provider.upload(buffer, { key: 'test.webp', contentType: 'image/webp' }),
      ).rejects.toThrow(MediaStorageException);
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
