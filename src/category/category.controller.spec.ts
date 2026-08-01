import { Test, TestingModule } from '@nestjs/testing';
import { CategoryStatus } from '@prisma/client';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { GetCategoriesQueryDto } from './dto/get-categories-query.dto';

const mockCategoryService = {
  getAllCategories: jest.fn(),
  getCategoryTree: jest.fn(),
  getCategoryById: jest.fn(),
};

const CAT_ID_1 = '11111111-1111-1111-1111-111111111111';

const mockCategoryResponse = {
  id: CAT_ID_1,
  name: 'Electronics',
  slug: 'electronics',
  status: CategoryStatus.ACTIVE,
  description: 'Electronic products',
  logoUrl: null,
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CategoryController', () => {
  let controller: CategoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [{ provide: CategoryService, useValue: mockCategoryService }],
    }).compile();

    controller = module.get<CategoryController>(CategoryController);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAll', () => {
    it('delegates to service.getAllCategories', async () => {
      const query: GetCategoriesQueryDto = { page: 1, limit: 10 };
      const paginatedResult = {
        data: [mockCategoryResponse],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
      mockCategoryService.getAllCategories.mockResolvedValue(paginatedResult);

      const result = await controller.getAll(query);

      expect(mockCategoryService.getAllCategories).toHaveBeenCalledWith(query);
      expect(result).toBe(paginatedResult);
    });
  });

  describe('getTree', () => {
    it('delegates to service.getCategoryTree with optional parentId', async () => {
      const treeResult = [{ ...mockCategoryResponse, children: [] }];
      mockCategoryService.getCategoryTree.mockResolvedValue(treeResult);

      const result = await controller.getTree(CAT_ID_1);

      expect(mockCategoryService.getCategoryTree).toHaveBeenCalledWith(CAT_ID_1);
      expect(result).toBe(treeResult);
    });
  });

  describe('getCategoryById', () => {
    it('delegates to service.getCategoryById', async () => {
      mockCategoryService.getCategoryById.mockResolvedValue(mockCategoryResponse);

      const result = await controller.getCategoryById(CAT_ID_1);

      expect(mockCategoryService.getCategoryById).toHaveBeenCalledWith(CAT_ID_1);
      expect(result).toBe(mockCategoryResponse);
    });
  });
});
