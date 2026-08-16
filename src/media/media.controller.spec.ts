import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { FastifyRequest } from 'fastify';
import { MediaEmptyFileException } from '@/common/exceptions/media.exception';

describe('MediaController', () => {
  let controller: MediaController;

  const mockMediaService = {
    upload: jest.fn(),
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

  describe('upload', () => {
    it('successfully processes multipart request and calls mediaService.upload', async () => {
      const fakeBuffer = Buffer.from('test-data');
      const mockReq = {
        isMultipart: () => true,
        file: () =>
          Promise.resolve({
            toBuffer: () => Promise.resolve(fakeBuffer),
            mimetype: 'image/webp',
            filename: 'sample.webp',
            fields: {
              folder: { value: 'products/456' },
            },
          }),
      } as unknown as FastifyRequest;

      const uploadResult = {
        key: 'products/456/uuid.webp',
        url: 'https://cdn.timmbr.com/products/456/uuid.webp',
      };
      mockMediaService.upload.mockResolvedValue(uploadResult);

      const result = await controller.upload(mockReq);

      expect(mockMediaService.upload).toHaveBeenCalledWith(
        {
          buffer: fakeBuffer,
          mimetype: 'image/webp',
          size: fakeBuffer.length,
          originalname: 'sample.webp',
        },
        expect.objectContaining({
          folder: 'products/456',
        }),
      );
      expect(result).toBe(uploadResult);
    });

    it('throws MediaEmptyFileException if request is not multipart', async () => {
      const mockReq = {
        isMultipart: () => false,
      } as unknown as FastifyRequest;

      await expect(controller.upload(mockReq)).rejects.toThrow(MediaEmptyFileException);
    });

    it('throws MediaEmptyFileException if req.file() returns null', async () => {
      const mockReq = {
        isMultipart: () => true,
        file: () => Promise.resolve(null),
      } as unknown as FastifyRequest;

      await expect(controller.upload(mockReq)).rejects.toThrow(MediaEmptyFileException);
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
