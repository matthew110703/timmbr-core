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

describe('ProductService', () => {
  let service: ProductService;

  beforeEach(async () => {
    mockCategoryRepository.findById.mockResolvedValue({ id: CATEGORY_ID_1, name: 'Furniture' });
    mockBrandRepository.findById.mockResolvedValue({ id: BRAND_ID_1, name: 'IKEA' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: ProductRepository, useValue: mockProductRepository },
        { provide: CategoryRepository, useValue: mockCategoryRepository },
        { provide: BrandRepository, useValue: mockBrandRepository },
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
  });

  describe('getProductById', () => {
    it('returns product by id', async () => {
      mockProductRepository.findFirst.mockResolvedValue(mockProduct);

      const result = await service.getProductById(PRODUCT_ID_1);

      expect(mockProductRepository.findFirst).toHaveBeenCalledWith({ id: PRODUCT_ID_1 });
      expect(result.id).toBe(PRODUCT_ID_1);
    });

    it('throws ProductNotFoundException if product not found', async () => {
      mockProductRepository.findFirst.mockResolvedValue(null);

      await expect(service.getProductById(PRODUCT_ID_1)).rejects.toThrow(ProductNotFoundException);
    });

    it('filters by active status and visible variants when onlyActive is true', async () => {
      mockProductRepository.findFirst.mockResolvedValue(mockProduct);

      await service.getProductById(PRODUCT_ID_1, true);

      expect(mockProductRepository.findFirst).toHaveBeenCalledWith({
        id: PRODUCT_ID_1,
        status: ProductStatus.ACTIVE,
        variants: {
          some: {
            status: { in: ['ACTIVE', 'OUT_OF_STOCK'] },
          },
        },
      });
    });
  });

  describe('getProductBySlug', () => {
    it('returns product by slug', async () => {
      mockProductRepository.findFirst.mockResolvedValue(mockProduct);

      const result = await service.getProductBySlug('oak-dining-table');

      expect(mockProductRepository.findFirst).toHaveBeenCalledWith({ slug: 'oak-dining-table' });
      expect(result.slug).toBe('oak-dining-table');
    });

    it('throws ProductNotFoundException if slug not found', async () => {
      mockProductRepository.findFirst.mockResolvedValue(null);

      await expect(service.getProductBySlug('unknown-slug')).rejects.toThrow(
        ProductNotFoundException,
      );
    });

    it('filters by active status and visible variants when onlyActive is true', async () => {
      mockProductRepository.findFirst.mockResolvedValue(mockProduct);

      await service.getProductBySlug('oak-dining-table', true);

      expect(mockProductRepository.findFirst).toHaveBeenCalledWith({
        slug: 'oak-dining-table',
        status: ProductStatus.ACTIVE,
        variants: {
          some: {
            status: { in: ['ACTIVE', 'OUT_OF_STOCK'] },
          },
        },
      });
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
