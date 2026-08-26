import { Test, TestingModule } from '@nestjs/testing';
import { ProductImageService } from './product-image.service';
import { ProductImageRepository } from './product-image.repository';
import { ProductRepository } from '../product.repository';
import { VariantRepository } from '../variant/variant.repository';
import { MediaService } from '@/media/media.service';
import {
  ProductImageInvalidStorageKeyException,
  ProductImageInvalidVariantException,
  ProductImageNotFoundException,
  ProductImageObjectNotFoundInStorageException,
  ProductNotFoundException,
} from '@/common/exceptions/product.exception';

const PRODUCT_ID_1 = '11111111-1111-1111-1111-111111111111';
const PRODUCT_ID_2 = '99999999-9999-9999-9999-999999999999';
const VARIANT_ID_1 = '22222222-2222-2222-2222-222222222222';
const VARIANT_ID_OTHER = '33333333-3333-3333-3333-333333333333';
const IMAGE_ID_1 = '44444444-4444-4444-4444-444444444444';
const IMAGE_ID_2 = '55555555-5555-5555-5555-555555555555';

const mockProduct = {
  id: PRODUCT_ID_1,
  title: 'Solid Oak Dining Table',
};

const mockVariant = {
  id: VARIANT_ID_1,
  productId: PRODUCT_ID_1,
};

const mockVariantOther = {
  id: VARIANT_ID_OTHER,
  productId: PRODUCT_ID_2,
};

const mockImage1 = {
  id: IMAGE_ID_1,
  productId: PRODUCT_ID_1,
  variantId: VARIANT_ID_1,
  storageKey: `products/${PRODUCT_ID_1}/images/img1.webp`,
  altText: 'Front Image',
  sortOrder: 0,
  isPrimary: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockImage2 = {
  id: IMAGE_ID_2,
  productId: PRODUCT_ID_1,
  variantId: null,
  storageKey: `products/${PRODUCT_ID_1}/images/img2.webp`,
  altText: 'Back Image',
  sortOrder: 1,
  isPrimary: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('ProductImageService', () => {
  let service: ProductImageService;

  const mockRepository = {
    findById: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    setPrimary: jest.fn(),
    deleteManyByIds: jest.fn(),
  };

  const mockProductRepository = {
    findById: jest.fn(),
  };

  const mockVariantRepository = {
    findById: jest.fn(),
  };

  const mockMediaService = {
    getPresignedUploadUrls: jest.fn(),
    exists: jest.fn(),
    getPublicUrl: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductImageService,
        { provide: ProductImageRepository, useValue: mockRepository },
        { provide: ProductRepository, useValue: mockProductRepository },
        { provide: VariantRepository, useValue: mockVariantRepository },
        { provide: MediaService, useValue: mockMediaService },
      ],
    }).compile();

    service = module.get<ProductImageService>(ProductImageService);
    mockMediaService.getPublicUrl.mockImplementation(
      (key: string) => `https://cdn.timmbr.com/${key}`,
    );
    mockMediaService.exists.mockResolvedValue(true);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('presignUploadUrls', () => {
    it('successfully requests presigned URLs for the product images folder', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      const presignResponse = {
        files: [
          {
            fileName: 'front.webp',
            key: `products/${PRODUCT_ID_1}/images/uuid1.webp`,
            uploadUrl: 'https://signed-url.example.com',
            publicUrl: `https://cdn.timmbr.com/products/${PRODUCT_ID_1}/images/uuid1.webp`,
            expiresIn: 300,
          },
        ],
      };
      mockMediaService.getPresignedUploadUrls.mockResolvedValue(presignResponse);

      const result = await service.presignUploadUrls(PRODUCT_ID_1, {
        files: [{ fileName: 'front.webp', mimeType: 'image/webp' }],
      });

      expect(mockProductRepository.findById).toHaveBeenCalledWith(PRODUCT_ID_1);
      expect(mockMediaService.getPresignedUploadUrls).toHaveBeenCalledWith({
        folder: `products/${PRODUCT_ID_1}/images`,
        files: [{ fileName: 'front.webp', mimeType: 'image/webp' }],
      });
      expect(result).toBe(presignResponse);
    });

    it('throws ProductNotFoundException when product does not exist', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(
        service.presignUploadUrls(PRODUCT_ID_1, {
          files: [{ fileName: 'front.webp', mimeType: 'image/webp' }],
        }),
      ).rejects.toThrow(ProductNotFoundException);
    });
  });

  describe('registerImages', () => {
    it('registers valid batch images when storage keys are valid and objects exist in R2', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockVariantRepository.findById.mockResolvedValue(mockVariant);
      mockMediaService.exists.mockResolvedValue(true);
      mockRepository.createMany.mockResolvedValue([mockImage1, mockImage2]);

      const result = await service.registerImages(PRODUCT_ID_1, {
        images: [
          {
            storageKey: mockImage1.storageKey,
            variantId: VARIANT_ID_1,
            altText: 'Front Image',
            sortOrder: 0,
            isPrimary: true,
          },
          {
            storageKey: mockImage2.storageKey,
            altText: 'Back Image',
            sortOrder: 1,
            isPrimary: false,
          },
        ],
      });

      expect(mockMediaService.exists).toHaveBeenCalledWith(mockImage1.storageKey);
      expect(mockMediaService.exists).toHaveBeenCalledWith(mockImage2.storageKey);
      expect(mockRepository.createMany).toHaveBeenCalledWith(PRODUCT_ID_1, expect.any(Array), true);
      expect(result.images).toHaveLength(2);
      expect(result.images[0].url).toBe(`https://cdn.timmbr.com/${mockImage1.storageKey}`);
      expect(result.images[1].url).toBe(`https://cdn.timmbr.com/${mockImage2.storageKey}`);
    });

    it('throws ProductImageInvalidStorageKeyException if storageKey does not match product folder prefix', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);

      await expect(
        service.registerImages(PRODUCT_ID_1, {
          images: [{ storageKey: 'products/OTHER_ID/images/img.webp' }],
        }),
      ).rejects.toThrow(ProductImageInvalidStorageKeyException);
    });

    it('throws ProductImageObjectNotFoundInStorageException if object does not exist in R2', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockMediaService.exists.mockResolvedValue(false);

      await expect(
        service.registerImages(PRODUCT_ID_1, {
          images: [{ storageKey: `products/${PRODUCT_ID_1}/images/not-uploaded.webp` }],
        }),
      ).rejects.toThrow(ProductImageObjectNotFoundInStorageException);
      expect(mockRepository.createMany).not.toHaveBeenCalled();
    });

    it('throws ProductNotFoundException if product is missing', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(
        service.registerImages(PRODUCT_ID_1, {
          images: [{ storageKey: `products/${PRODUCT_ID_1}/images/img.webp` }],
        }),
      ).rejects.toThrow(ProductNotFoundException);
    });

    it('throws ProductImageInvalidVariantException if variant belongs to another product', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockVariantRepository.findById.mockResolvedValue(mockVariantOther);

      await expect(
        service.registerImages(PRODUCT_ID_1, {
          images: [
            {
              storageKey: `products/${PRODUCT_ID_1}/images/img.webp`,
              variantId: VARIANT_ID_OTHER,
            },
          ],
        }),
      ).rejects.toThrow(ProductImageInvalidVariantException);
    });

    it('throws ProductImageInvalidVariantException if variant does not exist', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockVariantRepository.findById.mockResolvedValue(null);

      await expect(
        service.registerImages(PRODUCT_ID_1, {
          images: [
            {
              storageKey: `products/${PRODUCT_ID_1}/images/img.webp`,
              variantId: 'non-existent',
            },
          ],
        }),
      ).rejects.toThrow(ProductImageInvalidVariantException);
    });
  });

  describe('setPrimaryImage', () => {
    it('sets primary image successfully', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockRepository.findById.mockResolvedValue(mockImage2);
      mockRepository.setPrimary.mockResolvedValue({ ...mockImage2, isPrimary: true });

      const result = await service.setPrimaryImage(PRODUCT_ID_1, IMAGE_ID_2);

      expect(mockRepository.setPrimary).toHaveBeenCalledWith(PRODUCT_ID_1, IMAGE_ID_2);
      expect(result.isPrimary).toBe(true);
      expect(result.url).toBe(`https://cdn.timmbr.com/${mockImage2.storageKey}`);
    });

    it('throws ProductImageNotFoundException if image belongs to another product', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockRepository.findById.mockResolvedValue({ ...mockImage1, productId: PRODUCT_ID_2 });

      await expect(service.setPrimaryImage(PRODUCT_ID_1, IMAGE_ID_1)).rejects.toThrow(
        ProductImageNotFoundException,
      );
    });

    it('throws ProductImageNotFoundException if image is not found', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.setPrimaryImage(PRODUCT_ID_1, IMAGE_ID_1)).rejects.toThrow(
        ProductImageNotFoundException,
      );
    });
  });

  describe('deleteImages', () => {
    it('deletes images and calls mediaService.delete for each deleted storageKey', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockRepository.deleteManyByIds.mockResolvedValue([mockImage1, mockImage2]);
      mockMediaService.delete.mockResolvedValue(undefined);

      const result = await service.deleteImages(PRODUCT_ID_1, {
        imageIds: [IMAGE_ID_1, IMAGE_ID_2],
      });

      expect(mockRepository.deleteManyByIds).toHaveBeenCalledWith(PRODUCT_ID_1, [
        IMAGE_ID_1,
        IMAGE_ID_2,
      ]);
      expect(mockMediaService.delete).toHaveBeenCalledTimes(2);
      expect(mockMediaService.delete).toHaveBeenCalledWith(mockImage1.storageKey);
      expect(mockMediaService.delete).toHaveBeenCalledWith(mockImage2.storageKey);
      expect(result).toEqual({
        deletedCount: 2,
        deletedIds: [IMAGE_ID_1, IMAGE_ID_2],
      });
    });

    it('throws ProductImageNotFoundException if no images were found/deleted', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockRepository.deleteManyByIds.mockResolvedValue([]);

      await expect(service.deleteImages(PRODUCT_ID_1, { imageIds: [IMAGE_ID_1] })).rejects.toThrow(
        ProductImageNotFoundException,
      );
    });
  });

  describe('getImages', () => {
    it('returns all images for a product with public URLs', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockRepository.findMany.mockResolvedValue([mockImage1, mockImage2]);

      const result = await service.getImages(PRODUCT_ID_1);

      expect(mockRepository.findMany).toHaveBeenCalledWith({ productId: PRODUCT_ID_1 });
      expect(result.images).toHaveLength(2);
      expect(result.images[0].url).toBe(`https://cdn.timmbr.com/${mockImage1.storageKey}`);
    });

    it('filters by variantId when provided in query', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockRepository.findMany.mockResolvedValue([mockImage1]);

      const result = await service.getImages(PRODUCT_ID_1, { variantId: VARIANT_ID_1 });

      expect(mockRepository.findMany).toHaveBeenCalledWith({
        productId: PRODUCT_ID_1,
        variantId: VARIANT_ID_1,
      });
      expect(result.images).toHaveLength(1);
    });
  });
});
