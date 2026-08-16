import { Test, TestingModule } from '@nestjs/testing';
import { ProductStatus } from '@prisma/client';
import { ProductAdminController } from './product.admin.controller';
import { ProductService } from '../product.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { GetProductsQueryDto } from '../dto/get-products-query.dto';

const mockProductService = {
  getAllProducts: jest.fn(),
  getProductById: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
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

describe('ProductAdminController', () => {
  let controller: ProductAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductAdminController],
      providers: [{ provide: ProductService, useValue: mockProductService }],
    }).compile();

    controller = module.get<ProductAdminController>(ProductAdminController);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAll', () => {
    it('delegates to service.getAllProducts', async () => {
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

      expect(mockProductService.getAllProducts).toHaveBeenCalledWith(query);
      expect(result).toBe(paginatedResult);
    });
  });

  describe('getProductById', () => {
    it('delegates to service.getProductById', async () => {
      mockProductService.getProductById.mockResolvedValue(mockProductResponse);

      const result = await controller.getProductById(PRODUCT_ID_1);

      expect(mockProductService.getProductById).toHaveBeenCalledWith(PRODUCT_ID_1);
      expect(result).toBe(mockProductResponse);
    });
  });

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto: CreateProductDto = {
        title: 'Oak Dining Table',
        shortDescription: 'Solid oak table',
        categoryId: CATEGORY_ID_1,
      };
      mockProductService.create.mockResolvedValue(mockProductResponse);

      const result = await controller.create(dto);

      expect(mockProductService.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(mockProductResponse);
    });
  });

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto: UpdateProductDto = { title: 'Oak Dining Table Updated' };
      mockProductService.update.mockResolvedValue(mockProductResponse);

      const result = await controller.update(PRODUCT_ID_1, dto);

      expect(mockProductService.update).toHaveBeenCalledWith(PRODUCT_ID_1, dto);
      expect(result).toBe(mockProductResponse);
    });
  });

  describe('delete', () => {
    it('delegates to service.delete', async () => {
      mockProductService.delete.mockResolvedValue(mockProductResponse);

      const result = await controller.delete(PRODUCT_ID_1);

      expect(mockProductService.delete).toHaveBeenCalledWith(PRODUCT_ID_1);
      expect(result).toBe(mockProductResponse);
    });
  });
});
