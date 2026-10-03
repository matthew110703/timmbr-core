import { Test, TestingModule } from '@nestjs/testing';
import { ProductStatus } from '@prisma/client';
import { ProductService } from './product.service';
import { ProductRepository } from './product.repository';
import { CategoryRepository } from '@/category/category.repository';
import { BrandRepository } from '@/brand/brand.repository';
import {
  ProductAlreadyExistsException,
  ProductNotFoundException,
} from '@/common/exceptions/product.exception';
import { CategoryNotFoundException } from '@/common/exceptions/category.exception';
import { BrandNotFoundException } from '@/common/exceptions/brand.exception';

import { AttributeValueService } from './attribute/services/attribute-value.service';
import { ProductCacheService } from './cache/product-cache.service';
import { MediaService } from '@/media/media.service';

const PRODUCT_ID_1 = '11111111-1111-1111-1111-111111111111';
const CATEGORY_ID_1 = '22222222-2222-2222-2222-222222222222';
const BRAND_ID_1 = '33333333-3333-3333-3333-333333333333';

const mockProduct = {
  id: PRODUCT_ID_1,
  title: 'Oak Dining Table',
  slug: 'oak-dining-table',
  description: 'Solid oak wood dining table',
  shortDescription: 'Solid oak table',
  status: ProductStatus.ACTIVE,
  hsnCode: '940360',
  gstRate: 18,
  brandId: BRAND_ID_1,
  categoryId: CATEGORY_ID_1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockProductRepository = {
  findById: jest.fn(),
  findBySlug: jest.fn(),
  findFirst: jest.fn(),
  findFirstWithDetails: jest.fn(),
  findByIdWithDetails: jest.fn(),
  findBySlugWithDetails: jest.fn(),
  findPaginated: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockCategoryRepository = {
  findById: jest.fn(),
};

const mockBrandRepository = {
  findById: jest.fn(),
};

const mockAttributeValueService = {
  getFilterMetadata: jest.fn(),
};

const mockProductCacheService = {
  get: jest.fn().mockReturnValue(null),
  set: jest.fn(),
  invalidate: jest.fn(),
};

const mockMediaService = {
  getPublicUrl: jest.fn().mockImplementation((key: string) => `https://cdn.example.com/${key}`),
};

describe('ProductService', () => {
  let service: ProductService;

  beforeEach(async () => {
    mockCategoryRepository.findById.mockResolvedValue({ id: CATEGORY_ID_1, name: 'Furniture' });
    mockBrandRepository.findById.mockResolvedValue({ id: BRAND_ID_1, name: 'IKEA' });
    mockMediaService.getPublicUrl.mockImplementation(
      (key: string) => `https://cdn.example.com/${key}`,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: ProductRepository, useValue: mockProductRepository },
        { provide: CategoryRepository, useValue: mockCategoryRepository },
        { provide: BrandRepository, useValue: mockBrandRepository },
        { provide: AttributeValueService, useValue: mockAttributeValueService },
        { provide: ProductCacheService, useValue: mockProductCacheService },
        { provide: MediaService, useValue: mockMediaService },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a new product when title, category, and brand exist', async () => {
      mockProductRepository.findFirst.mockResolvedValue(null);
      mockProductRepository.create.mockResolvedValue(mockProduct);

      const result = await service.create({
        title: 'Oak Dining Table',
        shortDescription: 'Solid oak table',
        categoryId: CATEGORY_ID_1,
        brandId: BRAND_ID_1,
      });

      expect(mockCategoryRepository.findById).toHaveBeenCalledWith(CATEGORY_ID_1);
      expect(mockBrandRepository.findById).toHaveBeenCalledWith(BRAND_ID_1);
      expect(mockProductRepository.create).toHaveBeenCalled();
      expect(result.id).toBe(PRODUCT_ID_1);
    });

    it('throws CategoryNotFoundException if categoryId does not exist', async () => {
      mockCategoryRepository.findById.mockResolvedValue(null);

      await expect(
        service.create({
          title: 'Oak Dining Table',
          shortDescription: 'Solid oak table',
          categoryId: 'non-existent-cat-id',
        }),
      ).rejects.toThrow(CategoryNotFoundException);
    });

    it('throws BrandNotFoundException if brandId does not exist', async () => {
      mockBrandRepository.findById.mockResolvedValue(null);

      await expect(
        service.create({
          title: 'Oak Dining Table',
          shortDescription: 'Solid oak table',
          categoryId: CATEGORY_ID_1,
          brandId: 'non-existent-brand-id',
        }),
      ).rejects.toThrow(BrandNotFoundException);
    });

    it('throws ProductAlreadyExistsException if product title already exists', async () => {
      mockProductRepository.findFirst.mockResolvedValue(mockProduct);

      await expect(
        service.create({
          title: 'Oak Dining Table',
          shortDescription: 'Solid oak table',
          categoryId: CATEGORY_ID_1,
        }),
      ).rejects.toThrow(ProductAlreadyExistsException);
    });
  });

  describe('update', () => {
    it('updates product successfully', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockProductRepository.update.mockResolvedValue({
        ...mockProduct,
        title: 'Updated Table',
      });

      const result = await service.update(PRODUCT_ID_1, { title: 'Updated Table' });

      expect(mockProductRepository.findById).toHaveBeenCalledWith(PRODUCT_ID_1);
      expect(mockProductRepository.update).toHaveBeenCalled();
      expect(result.title).toBe('Updated Table');
    });

    it('throws ProductNotFoundException if product does not exist', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(service.update(PRODUCT_ID_1, { title: 'New' })).rejects.toThrow(
        ProductNotFoundException,
      );
    });

    it('throws CategoryNotFoundException if categoryId on update does not exist', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockCategoryRepository.findById.mockResolvedValue(null);

      await expect(service.update(PRODUCT_ID_1, { categoryId: 'invalid-cat-id' })).rejects.toThrow(
        CategoryNotFoundException,
      );
    });

    it('throws ProductAlreadyExistsException if new title conflicts with another product', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockProductRepository.findFirst.mockResolvedValue({
        ...mockProduct,
        id: 'different-id',
      });

      await expect(
        service.update(PRODUCT_ID_1, { title: 'Existing Product Title' }),
      ).rejects.toThrow(ProductAlreadyExistsException);
    });
  });

  describe('getAllProducts', () => {
    it('returns paginated product list', async () => {
      mockProductRepository.findPaginated.mockResolvedValue([[mockProduct], 1]);

      const result = await service.getAllProducts({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('filters active products when onlyActive is true', async () => {
      mockProductRepository.findPaginated.mockResolvedValue([[mockProduct], 1]);

      await service.getAllProducts({}, true);

      expect(mockProductRepository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ status: ProductStatus.ACTIVE }),
        1,
        10,
      );
    });

    it('filters by productIds, categoryIds, and brandIds when provided', async () => {
      mockProductRepository.findPaginated.mockResolvedValue([[mockProduct], 1]);

      await service.getAllProducts({
        productIds: [PRODUCT_ID_1],
        categoryIds: [CATEGORY_ID_1],
        brandIds: [BRAND_ID_1],
      });

      expect(mockProductRepository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({
          id: { in: [PRODUCT_ID_1] },
          categoryId: { in: [CATEGORY_ID_1] },
          brandId: { in: [BRAND_ID_1] },
        }),
        1,
        10,
      );
    });

    it('maps primary coverImage with public CDN URL', async () => {
      const productWithImage = {
        ...mockProduct,
        images: [
          {
            id: 'img-1',
            storageKey: 'products/111/images/cover.webp',
            altText: 'Cover photo',
            sortOrder: 0,
            isPrimary: true,
          },
        ],
      };
      mockProductRepository.findPaginated.mockResolvedValue([[productWithImage], 1]);

      const result = await service.getAllProducts({});

      expect(result.data[0].coverImage).toEqual({
        id: 'img-1',
        url: 'https://cdn.example.com/products/111/images/cover.webp',
        altText: 'Cover photo',
      });
    });

    it('maps pricing fields from default active variant', async () => {
      const productWithVariants = {
        ...mockProduct,
        variants: [
          {
            id: 'var-1',
            productId: PRODUCT_ID_1,
            sku: 'SKU-1',
            price: 24999,
            compareAtPrice: 29999,
            currency: 'INR',
            isDefault: true,
            status: 'ACTIVE',
          },
          {
            id: 'var-2',
            productId: PRODUCT_ID_1,
            sku: 'SKU-2',
            price: 34999,
            compareAtPrice: null,
            currency: 'INR',
            isDefault: false,
            status: 'ACTIVE',
          },
        ],
      };
      mockProductRepository.findPaginated.mockResolvedValue([[productWithVariants], 1]);

      const result = await service.getAllProducts({});

      expect(result.data[0].price).toBe(24999);
      expect(result.data[0].compareAtPrice).toBe(29999);
      expect(result.data[0].currency).toBe('INR');
      expect(result.data[0].hasMultipleVariants).toBe(true);
    });

    it('returns null pricing when product has no variants', async () => {
      const productWithoutVariants = {
        ...mockProduct,
        variants: [],
      };
      mockProductRepository.findPaginated.mockResolvedValue([[productWithoutVariants], 1]);

      const result = await service.getAllProducts({});

      expect(result.data[0].price).toBeNull();
      expect(result.data[0].compareAtPrice).toBeNull();
      expect(result.data[0].currency).toBeNull();
      expect(result.data[0].hasMultipleVariants).toBe(false);
    });
  });

  describe('getProductById', () => {
    it('returns product by id', async () => {
      mockProductRepository.findByIdWithDetails.mockResolvedValue(mockProduct);

      const result = await service.getProductById(PRODUCT_ID_1);

      expect(mockProductRepository.findByIdWithDetails).toHaveBeenCalledWith(PRODUCT_ID_1, false);
      expect(result.id).toBe(PRODUCT_ID_1);
    });

    it('throws ProductNotFoundException if product not found', async () => {
      mockProductRepository.findByIdWithDetails.mockResolvedValue(null);

      await expect(service.getProductById(PRODUCT_ID_1)).rejects.toThrow(ProductNotFoundException);
    });

    it('throws ProductNotFoundException when onlyActive is true but product status is not active', async () => {
      mockProductRepository.findByIdWithDetails.mockResolvedValue({
        ...mockProduct,
        status: ProductStatus.DRAFT,
      });

      await expect(service.getProductById(PRODUCT_ID_1, true)).rejects.toThrow(
        ProductNotFoundException,
      );
    });
  });

  describe('getProductBySlug', () => {
    it('returns product by slug', async () => {
      mockProductRepository.findBySlugWithDetails.mockResolvedValue(mockProduct);

      const result = await service.getProductBySlug('oak-dining-table');

      expect(mockProductRepository.findBySlugWithDetails).toHaveBeenCalledWith(
        'oak-dining-table',
        false,
      );
      expect(result.slug).toBe('oak-dining-table');
    });

    it('throws ProductNotFoundException if slug not found', async () => {
      mockProductRepository.findBySlugWithDetails.mockResolvedValue(null);

      await expect(service.getProductBySlug('unknown-slug')).rejects.toThrow(
        ProductNotFoundException,
      );
    });

    it('throws ProductNotFoundException when onlyActive is true but product status is not active', async () => {
      mockProductRepository.findBySlugWithDetails.mockResolvedValue({
        ...mockProduct,
        status: ProductStatus.DRAFT,
      });

      await expect(service.getProductBySlug('oak-dining-table', true)).rejects.toThrow(
        ProductNotFoundException,
      );
    });
  });

  describe('getFilterMetadata', () => {
    it('delegates to attributeValueService.getFilterMetadata', async () => {
      mockAttributeValueService.getFilterMetadata.mockResolvedValue([
        { name: 'Color', type: 'STRING', options: [{ value: 'Black', count: 5 }] },
      ]);

      const result = await service.getFilterMetadata();
      expect(mockAttributeValueService.getFilterMetadata).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Color');
    });
  });

  describe('delete', () => {
    it('deletes product successfully', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockProductRepository.delete.mockResolvedValue(mockProduct);

      const result = await service.delete(PRODUCT_ID_1);

      expect(mockProductRepository.delete).toHaveBeenCalledWith(PRODUCT_ID_1);
      expect(result.id).toBe(PRODUCT_ID_1);
    });

    it('throws ProductNotFoundException if product to delete is not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      await expect(service.delete(PRODUCT_ID_1)).rejects.toThrow(ProductNotFoundException);
    });
  });
});
