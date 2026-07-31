import { Test, TestingModule } from '@nestjs/testing';
import { CategoryStatus } from '@prisma/client';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { GetCategoriesQueryDto } from './dto/get-categories-query.dto';

const mockCategoriesService = {
  getAllCategories: jest.fn(),
  getCategoryTree: jest.fn(),
  getCategoryById: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
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

describe('CategoriesController', () => {
  let controller: CategoriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: mockCategoriesService }],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
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
      mockCategoriesService.getAllCategories.mockResolvedValue(paginatedResult);

      const result = await controller.getAll(query);

      expect(mockCategoriesService.getAllCategories).toHaveBeenCalledWith(query);
      expect(result).toBe(paginatedResult);
    });
  });

  describe('getTree', () => {
    it('delegates to service.getCategoryTree with optional parentId', async () => {
      const treeResult = [{ ...mockCategoryResponse, children: [] }];
      mockCategoriesService.getCategoryTree.mockResolvedValue(treeResult);

      const result = await controller.getTree(CAT_ID_1);

      expect(mockCategoriesService.getCategoryTree).toHaveBeenCalledWith(CAT_ID_1);
      expect(result).toBe(treeResult);
    });
  });

  describe('getCategoryById', () => {
    it('delegates to service.getCategoryById', async () => {
      mockCategoriesService.getCategoryById.mockResolvedValue(mockCategoryResponse);

      const result = await controller.getCategoryById(CAT_ID_1);

      expect(mockCategoriesService.getCategoryById).toHaveBeenCalledWith(CAT_ID_1);
      expect(result).toBe(mockCategoryResponse);
    });
  });

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto: CreateCategoryDto = {
        name: 'Electronics',
        status: CategoryStatus.ACTIVE,
      };
      mockCategoriesService.create.mockResolvedValue(mockCategoryResponse);

      const result = await controller.create(dto);

      expect(mockCategoriesService.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(mockCategoryResponse);
    });
  });

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto: UpdateCategoryDto = { name: 'Updated Electronics' };
      mockCategoriesService.update.mockResolvedValue(mockCategoryResponse);

      const result = await controller.update(CAT_ID_1, dto);

      expect(mockCategoriesService.update).toHaveBeenCalledWith(CAT_ID_1, dto);
      expect(result).toBe(mockCategoryResponse);
    });
  });

  describe('delete', () => {
    it('delegates to service.delete', async () => {
      mockCategoriesService.delete.mockResolvedValue(mockCategoryResponse);

      const result = await controller.delete(CAT_ID_1);

      expect(mockCategoriesService.delete).toHaveBeenCalledWith(CAT_ID_1);
      expect(result).toBe(mockCategoryResponse);
    });
  });
});
