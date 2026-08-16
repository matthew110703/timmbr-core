import { Test, TestingModule } from '@nestjs/testing';
import { ProductStatus } from '@prisma/client';
import { ProductController } from './product.controller';
import { ProductService } from '../product.service';
import { GetProductsQueryDto } from '../dto/get-products-query.dto';

const mockProductService = {
  getAllProducts: jest.fn(),
  getProductById: jest.fn(),
  getProductBySlug: jest.fn(),
};

const PRODUCT_ID_1 = '11111111-1111-1111-1111-111111111111';
const CATEGORY_ID_1 = '22222222-2222-2222-2222-222222222222';
const BRAND_ID_1 = '33333333-3333-3333-3333-333333333333';

const mockProductResponse = {
  id: PRODUCT_ID_1,
  title: 'Oak Dining Table',
  slug: 'oak-dining-table',
  description: 'Solid oak table',
  shortDescription: 'Solid oak table',
  status: ProductStatus.ACTIVE,
  hsnCode: '940360',
  gstRate: 18,
  brandId: BRAND_ID_1,
  categoryId: CATEGORY_ID_1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ProductController', () => {
  let controller: ProductController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: ProductService, useValue: mockProductService }],
    }).compile();

    controller = module.get<ProductController>(ProductController);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAll', () => {
    it('delegates to service.getAllProducts with onlyActive=true', async () => {
      const query: GetProductsQueryDto = { page: 1, limit: 10 };
      const paginatedResult = {
        data: [mockProductResponse],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
      mockProductService.getAllProducts.mockResolvedValue(paginatedResult);

      const result = await controller.getAll(query);

      expect(mockProductService.getAllProducts).toHaveBeenCalledWith(query, true);
      expect(result).toBe(paginatedResult);
    });
  });

  describe('getProductBySlug', () => {
    it('delegates to service.getProductBySlug with onlyActive=true', async () => {
      mockProductService.getProductBySlug.mockResolvedValue(mockProductResponse);

      const result = await controller.getProductBySlug('oak-dining-table');

      expect(mockProductService.getProductBySlug).toHaveBeenCalledWith('oak-dining-table', true);
      expect(result).toBe(mockProductResponse);
    });
  });

  describe('getProductById', () => {
    it('delegates to service.getProductById with onlyActive=true', async () => {
      mockProductService.getProductById.mockResolvedValue(mockProductResponse);

      const result = await controller.getProductById(PRODUCT_ID_1);

      expect(mockProductService.getProductById).toHaveBeenCalledWith(PRODUCT_ID_1, true);
      expect(result).toBe(mockProductResponse);
    });
  });
});
