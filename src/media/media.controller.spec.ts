import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

describe('MediaController', () => {
  let controller: MediaController;

  const mockMediaService = {
    getPresignedUploadUrls: jest.fn(),
    delete: jest.fn(),
    getPublicUrl: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        {
          provide: MediaService,
          useValue: mockMediaService,
        },
      ],
    }).compile();

    controller = module.get<MediaController>(MediaController);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generatePresignedUrls', () => {
    it('calls mediaService.getPresignedUploadUrls and returns generated URLs', async () => {
      const dto = {
        folder: 'products/456',
        files: [
          {
            fileName: 'sample.webp',
            mimeType: 'image/webp',
            sizeBytes: 1024,
          },
        ],
      };

      const mockResponse = {
        files: [
          {
            fileName: 'sample.webp',
            key: 'products/456/uuid.webp',
            uploadUrl: 'https://signed.example.com/products/456/uuid.webp',
            publicUrl: 'https://cdn.timmbr.com/products/456/uuid.webp',
            expiresIn: 300,
          },
        ],
      };
      mockMediaService.getPresignedUploadUrls.mockResolvedValue(mockResponse);

      const result = await controller.generatePresignedUrls(dto);

      expect(mockMediaService.getPresignedUploadUrls).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getUrl', () => {
    it('returns public url for provided key', () => {
      mockMediaService.getPublicUrl.mockReturnValue(
        'https://cdn.timmbr.com/products/123/image.webp',
      );

      const result = controller.getUrl({ key: 'products/123/image.webp' });

      expect(mockMediaService.getPublicUrl).toHaveBeenCalledWith('products/123/image.webp');
      expect(result).toEqual({ url: 'https://cdn.timmbr.com/products/123/image.webp' });
    });
  });

  describe('delete', () => {
    it('deletes media using query parameter key and returns success true', async () => {
      mockMediaService.delete.mockResolvedValue(undefined);

      const result = await controller.delete({ key: 'products/123/image.webp' });

      expect(mockMediaService.delete).toHaveBeenCalledWith('products/123/image.webp');
      expect(result).toEqual({ success: true });
    });
  });
});
