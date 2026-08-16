import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { STORAGE_PROVIDER } from './interfaces/storage-provider.interface';
import { UploadedFile } from './interfaces/uploaded-file.interface';
import {
  MediaEmptyFileException,
  MediaFileTooLargeException,
  MediaUnsupportedTypeException,
} from '@/common/exceptions/media.exception';

describe('MediaService', () => {
  let service: MediaService;

  const mockStorageProvider = {
    upload: jest.fn(),
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

  describe('upload', () => {
    const validImageFile: UploadedFile = {
      buffer: Buffer.from('fake-image-data'),
      mimetype: 'image/webp',
      size: 15,
      originalname: 'sample.webp',
    };

    it('successfully uploads valid file with folder prefix and returns key and url', async () => {
      mockStorageProvider.upload.mockImplementation((_, options: { key?: string }) =>
        Promise.resolve({
          key: options.key ?? 'test.webp',
        }),
      );
      mockStorageProvider.getPublicUrl.mockImplementation(
        (key: string) => `https://cdn.timmbr.com/${key}`,
      );

      const result = await service.upload(validImageFile, {
        folder: 'products/123',
      });

      const [uploadBuffer, uploadOptions] = mockStorageProvider.upload.mock.calls[0] as [
        Buffer,
        { folder?: string; contentType?: string; key?: string },
      ];

      expect(uploadBuffer).toBe(validImageFile.buffer);
      expect(uploadOptions.folder).toBe('products/123');
      expect(uploadOptions.contentType).toBe('image/webp');
      expect(uploadOptions.key).toMatch(/^products\/123\/[0-9a-f-]+\.webp$/);
      expect(result.key).toMatch(/^products\/123\/[0-9a-f-]+\.webp$/);
      expect(result.url).toBe(`https://cdn.timmbr.com/${result.key}`);
    });

    it('generates key at root when folder is not provided', async () => {
      mockStorageProvider.upload.mockImplementation((_, options: { key?: string }) =>
        Promise.resolve({
          key: options.key ?? 'test.webp',
        }),
      );
      mockStorageProvider.getPublicUrl.mockImplementation(
        (key: string) => `https://cdn.timmbr.com/${key}`,
      );

      const result = await service.upload(validImageFile);

      expect(result.key).toMatch(/^[0-9a-f-]+\.webp$/);
      expect(result.url).toBe(`https://cdn.timmbr.com/${result.key}`);
    });

    it('throws MediaEmptyFileException when file buffer is empty', async () => {
      const emptyFile: UploadedFile = {
        buffer: Buffer.alloc(0),
        mimetype: 'image/jpeg',
        size: 0,
        originalname: 'empty.jpg',
      };

      await expect(service.upload(emptyFile)).rejects.toThrow(MediaEmptyFileException);
    });

    it('throws MediaUnsupportedTypeException for unsupported file types', async () => {
      const pdfFile: UploadedFile = {
        buffer: Buffer.from('pdf data'),
        mimetype: 'application/pdf',
        size: 8,
        originalname: 'doc.pdf',
      };

      await expect(service.upload(pdfFile)).rejects.toThrow(MediaUnsupportedTypeException);
    });

    it('throws MediaFileTooLargeException when image exceeds 10MB', async () => {
      const oversizedImage: UploadedFile = {
        buffer: Buffer.alloc(11 * 1024 * 1024),
        mimetype: 'image/jpeg',
        size: 11 * 1024 * 1024,
        originalname: 'big.jpg',
      };

      await expect(service.upload(oversizedImage)).rejects.toThrow(MediaFileTooLargeException);
    });

    it('allows video files up to 50MB', async () => {
      const videoFile: UploadedFile = {
        buffer: Buffer.from('video data'),
        mimetype: 'video/mp4',
        size: 10,
        originalname: 'clip.mp4',
      };
      mockStorageProvider.upload.mockImplementation((_, options: { key?: string }) =>
        Promise.resolve({
          key: options.key ?? 'test.mp4',
        }),
      );
      mockStorageProvider.getPublicUrl.mockReturnValue('https://cdn.timmbr.com/test.mp4');

      const result = await service.upload(videoFile);

      expect(result.key).toMatch(/^[0-9a-f-]+\.mp4$/);
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
