import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { STORAGE_PROVIDER } from './interfaces/storage-provider.interface';
import {
  MediaEmptyFileException,
  MediaFileTooLargeException,
  MediaUnsupportedTypeException,
} from '@/common/exceptions/media.exception';

describe('MediaService', () => {
  let service: MediaService;

  const mockStorageProvider = {
    getPresignedUploadUrl: jest.fn(),
    exists: jest.fn(),
    delete: jest.fn(),
    getPublicUrl: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: STORAGE_PROVIDER,
          useValue: mockStorageProvider,
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPresignedUploadUrls', () => {
    it('successfully generates presigned URL for a single file with folder prefix', async () => {
      mockStorageProvider.getPresignedUploadUrl.mockImplementation((options: { key: string }) =>
        Promise.resolve({
          uploadUrl: `https://signed.example.com/${options.key}`,
          key: options.key,
          expiresIn: 300,
        }),
      );
      mockStorageProvider.getPublicUrl.mockImplementation(
        (key: string) => `https://cdn.timmbr.com/${key}`,
      );

      const result = await service.getPresignedUploadUrls({
        folder: 'products/123',
        files: [
          {
            fileName: 'sample.webp',
            mimeType: 'image/webp',
            sizeBytes: 1024,
          },
        ],
      });

      expect(result.files).toHaveLength(1);
      const file = result.files[0];
      expect(file.fileName).toBe('sample.webp');
      expect(file.key).toMatch(/^products\/123\/[0-9a-f-]+\.webp$/);
      expect(file.uploadUrl).toBe(`https://signed.example.com/${file.key}`);
      expect(file.publicUrl).toBe(`https://cdn.timmbr.com/${file.key}`);
      expect(file.expiresIn).toBe(300);
    });

    it('generates presigned URLs for batch/multi-upload files without folder prefix', async () => {
      mockStorageProvider.getPresignedUploadUrl.mockImplementation((options: { key: string }) =>
        Promise.resolve({
          uploadUrl: `https://signed.example.com/${options.key}`,
          key: options.key,
          expiresIn: 300,
        }),
      );
      mockStorageProvider.getPublicUrl.mockImplementation(
        (key: string) => `https://cdn.timmbr.com/${key}`,
      );

      const result = await service.getPresignedUploadUrls({
        files: [
          { fileName: 'img1.png', mimeType: 'image/png' },
          { fileName: 'video.mp4', mimeType: 'video/mp4', sizeBytes: 20 * 1024 * 1024 },
        ],
      });

      expect(result.files).toHaveLength(2);
      expect(result.files[0].key).toMatch(/^[0-9a-f-]+\.png$/);
      expect(result.files[1].key).toMatch(/^[0-9a-f-]+\.mp4$/);
    });

    it('throws MediaEmptyFileException when mimeType is missing or empty', async () => {
      await expect(
        service.getPresignedUploadUrls({
          files: [{ fileName: 'test.jpg', mimeType: '' }],
        }),
      ).rejects.toThrow(MediaEmptyFileException);
    });

    it('throws MediaEmptyFileException when sizeBytes is 0 or negative', async () => {
      await expect(
        service.getPresignedUploadUrls({
          files: [{ fileName: 'test.jpg', mimeType: 'image/jpeg', sizeBytes: 0 }],
        }),
      ).rejects.toThrow(MediaEmptyFileException);
    });

    it('throws MediaUnsupportedTypeException for unsupported mime types', async () => {
      await expect(
        service.getPresignedUploadUrls({
          files: [{ fileName: 'doc.pdf', mimeType: 'application/pdf' }],
        }),
      ).rejects.toThrow(MediaUnsupportedTypeException);
    });

    it('throws MediaFileTooLargeException when image exceeds 10MB', async () => {
      await expect(
        service.getPresignedUploadUrls({
          files: [
            {
              fileName: 'big.jpg',
              mimeType: 'image/jpeg',
              sizeBytes: 11 * 1024 * 1024,
            },
          ],
        }),
      ).rejects.toThrow(MediaFileTooLargeException);
    });

    it('allows video files up to 50MB and rejects above 50MB', async () => {
      mockStorageProvider.getPresignedUploadUrl.mockImplementation((options: { key: string }) =>
        Promise.resolve({
          uploadUrl: `https://signed.example.com/${options.key}`,
          key: options.key,
          expiresIn: 300,
        }),
      );
      mockStorageProvider.getPublicUrl.mockImplementation(
        (key: string) => `https://cdn.timmbr.com/${key}`,
      );

      const validVideoResult = await service.getPresignedUploadUrls({
        files: [
          {
            fileName: 'video.mp4',
            mimeType: 'video/mp4',
            sizeBytes: 50 * 1024 * 1024,
          },
        ],
      });

      expect(validVideoResult.files).toHaveLength(1);

      await expect(
        service.getPresignedUploadUrls({
          files: [
            {
              fileName: 'huge-video.mp4',
              mimeType: 'video/mp4',
              sizeBytes: 51 * 1024 * 1024,
            },
          ],
        }),
      ).rejects.toThrow(MediaFileTooLargeException);
    });
  });

  describe('exists', () => {
    it('delegates existence check to storage provider', async () => {
      mockStorageProvider.exists.mockResolvedValueOnce(true);

      const result = await service.exists('products/123/image.webp');

      expect(mockStorageProvider.exists).toHaveBeenCalledWith('products/123/image.webp');
      expect(result).toBe(true);
    });
  });

  describe('delete', () => {
    it('delegates deletion to storage provider', async () => {
      mockStorageProvider.delete.mockResolvedValueOnce(undefined);

      await service.delete('products/123/image.webp');

      expect(mockStorageProvider.delete).toHaveBeenCalledWith('products/123/image.webp');
    });
  });

  describe('getPublicUrl', () => {
    it('delegates public url retrieval to storage provider', () => {
      mockStorageProvider.getPublicUrl.mockReturnValue(
        'https://cdn.timmbr.com/products/123/image.webp',
      );

      const url = service.getPublicUrl('products/123/image.webp');

      expect(mockStorageProvider.getPublicUrl).toHaveBeenCalledWith('products/123/image.webp');
      expect(url).toBe('https://cdn.timmbr.com/products/123/image.webp');
    });
  });
});
