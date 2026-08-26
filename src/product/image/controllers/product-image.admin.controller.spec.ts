import { Test, TestingModule } from '@nestjs/testing';
import { ProductImageAdminController } from './product-image.admin.controller';
import { ProductImageService } from '../product-image.service';

const PRODUCT_ID_1 = '11111111-1111-1111-1111-111111111111';
const IMAGE_ID_1 = '22222222-2222-2222-2222-222222222222';

describe('ProductImageAdminController', () => {
  let controller: ProductImageAdminController;

  const mockService = {
    presignUploadUrls: jest.fn(),
    registerImages: jest.fn(),
    getImages: jest.fn(),
    setPrimaryImage: jest.fn(),
    deleteImages: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductImageAdminController],
      providers: [
        {
          provide: ProductImageService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ProductImageAdminController>(ProductImageAdminController);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('presign', () => {
    it('calls service.presignUploadUrls with productId and dto', async () => {
      const dto = { files: [{ fileName: 'front.webp', mimeType: 'image/webp' }] };
      const response = {
        files: [
          {
            fileName: 'front.webp',
            key: `products/${PRODUCT_ID_1}/images/uuid.webp`,
            uploadUrl: 'https://signed-url.example.com',
            publicUrl: 'https://cdn.timmbr.com/products/img.webp',
            expiresIn: 300,
          },
        ],
      };
      mockService.presignUploadUrls.mockResolvedValue(response);

      const result = await controller.presign(PRODUCT_ID_1, dto);

      expect(mockService.presignUploadUrls).toHaveBeenCalledWith(PRODUCT_ID_1, dto);
      expect(result).toBe(response);
    });
  });

  describe('create', () => {
    it('calls service.registerImages with productId and dto', async () => {
      const dto = {
        images: [
          {
            storageKey: `products/${PRODUCT_ID_1}/images/uuid.webp`,
            isPrimary: true,
          },
        ],
      };
      const response = {
        images: [
          {
            id: IMAGE_ID_1,
            productId: PRODUCT_ID_1,
            variantId: null,
            storageKey: `products/${PRODUCT_ID_1}/images/uuid.webp`,
            url: 'https://cdn.timmbr.com/products/img.webp',
            altText: null,
            sortOrder: 0,
            isPrimary: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };
      mockService.registerImages.mockResolvedValue(response);

      const result = await controller.create(PRODUCT_ID_1, dto);

      expect(mockService.registerImages).toHaveBeenCalledWith(PRODUCT_ID_1, dto);
      expect(result).toBe(response);
    });
  });

  describe('getAll', () => {
    it('calls service.getImages with productId and query', async () => {
      const query = { variantId: '22222222-2222-2222-2222-222222222222' };
      const response = { images: [] };
      mockService.getImages.mockResolvedValue(response);

      const result = await controller.getAll(PRODUCT_ID_1, query);

      expect(mockService.getImages).toHaveBeenCalledWith(PRODUCT_ID_1, query);
      expect(result).toBe(response);
    });
  });

  describe('setPrimary', () => {
    it('calls service.setPrimaryImage with productId and imageId', async () => {
      const response = {
        id: IMAGE_ID_1,
        productId: PRODUCT_ID_1,
        variantId: null,
        storageKey: `products/${PRODUCT_ID_1}/images/uuid.webp`,
        url: 'https://cdn.timmbr.com/products/img.webp',
        altText: null,
        sortOrder: 0,
        isPrimary: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockService.setPrimaryImage.mockResolvedValue(response);

      const result = await controller.setPrimary(PRODUCT_ID_1, IMAGE_ID_1);

      expect(mockService.setPrimaryImage).toHaveBeenCalledWith(PRODUCT_ID_1, IMAGE_ID_1);
      expect(result).toBe(response);
    });
  });

  describe('delete', () => {
    it('calls service.deleteImages with productId and dto', async () => {
      const dto = { imageIds: [IMAGE_ID_1] };
      const response = { deletedCount: 1, deletedIds: [IMAGE_ID_1] };
      mockService.deleteImages.mockResolvedValue(response);

      const result = await controller.delete(PRODUCT_ID_1, dto);

      expect(mockService.deleteImages).toHaveBeenCalledWith(PRODUCT_ID_1, dto);
      expect(result).toBe(response);
    });
  });
});
