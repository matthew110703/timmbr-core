import { Test, TestingModule } from '@nestjs/testing';
import { CategoryStatus } from '@prisma/client';
import { CategoryService } from './category.service';
import { CategoryRepository } from './category.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { GetCategoriesQueryDto } from './dto/get-categories-query.dto';
import {
  CategoryAlreadyExistsException,
  CategoryHasChildrenException,
  CategoryNotFoundException,
  CategorySelfReferentialException,
} from '@/common/exceptions/category.exception';

const CAT_ID_1 = '11111111-1111-1111-1111-111111111111';
const CAT_ID_2 = '22222222-2222-2222-2222-222222222222';
const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000';

const baseCategory = {
  id: CAT_ID_1,
  name: 'Electronics',
  slug: 'electronics',
  status: CategoryStatus.ACTIVE,
  description: 'Electronic devices',
  logoUrl: 'http://example.com/logo.png',
  parentId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const subCategory = {
  id: CAT_ID_2,
  name: 'Smartphones',
  slug: 'smartphones',
  status: CategoryStatus.ACTIVE,
  description: 'Mobile phones',
  logoUrl: null,
  parentId: CAT_ID_1,
  createdAt: new Date('2026-01-02'),
  updatedAt: new Date('2026-01-02'),
};

const inactiveCategory = {
  ...subCategory,
  id: '33333333-3333-3333-3333-333333333333',
  name: 'Old Gadgets',
  status: CategoryStatus.INACTIVE,
};

const mockCategoryRepository = {
  findById: jest.fn(),
  findByIdWithParent: jest.fn(),
  findFirst: jest.fn(),
  findAllSortedByName: jest.fn(),
  findPaginated: jest.fn(),
  countChildren: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  deleteTree: jest.fn(),
};

describe('CategoryService', () => {
  let service: CategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: CategoryRepository, useValue: mockCategoryRepository },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getCategoryTree ─────────────────────────────────────────────────────────

  describe('getCategoryTree', () => {
    it('returns the full root category tree when no rootParentId is provided', async () => {
      mockCategoryRepository.findAllSortedByName.mockResolvedValue([baseCategory, subCategory]);

      const tree = await service.getCategoryTree();

      expect(tree).toHaveLength(1);
      expect(tree[0]).toMatchObject({
        id: CAT_ID_1,
        name: 'Electronics',
        children: [
          expect.objectContaining({
            id: CAT_ID_2,
            name: 'Smartphones',
            children: [],
          }),
        ],
      });
    });

    it('returns subtree starting from rootParentId when valid rootParentId is provided', async () => {
      mockCategoryRepository.findById.mockResolvedValue(baseCategory);
      mockCategoryRepository.findAllSortedByName.mockResolvedValue([baseCategory, subCategory]);

      const tree = await service.getCategoryTree(CAT_ID_1);

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(CAT_ID_2);
    });

    it('filters out INACTIVE categories when onlyActive=true', async () => {
      mockCategoryRepository.findAllSortedByName.mockResolvedValue([
        baseCategory,
        subCategory,
        inactiveCategory,
      ]);

      const tree = await service.getCategoryTree(undefined, true);

      expect(tree).toHaveLength(1);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children?.[0]?.id).toBe(CAT_ID_2);
    });

    it('throws CategoryNotFoundException when rootParentId is not found', async () => {
      mockCategoryRepository.findById.mockResolvedValue(null);

      await expect(service.getCategoryTree(NON_EXISTENT_ID)).rejects.toThrow(
        CategoryNotFoundException,
      );
    });

    it('throws CategoryNotFoundException when rootParentId is INACTIVE and onlyActive=true', async () => {
      mockCategoryRepository.findById.mockResolvedValue(inactiveCategory);

      await expect(service.getCategoryTree(inactiveCategory.id, true)).rejects.toThrow(
        CategoryNotFoundException,
      );
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateCategoryDto = {
      name: 'Electronics',
      status: CategoryStatus.ACTIVE,
      description: 'Electronic devices',
    };

    it('creates and returns a category when valid dto is provided', async () => {
      mockCategoryRepository.findFirst.mockResolvedValue(null);
      mockCategoryRepository.create.mockResolvedValue(baseCategory);

      const result = await service.create(dto);

      expect(mockCategoryRepository.findFirst).toHaveBeenCalledWith({ name: dto.name });
      expect(mockCategoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: dto.name,
          slug: 'electronics',
          status: CategoryStatus.ACTIVE,
        }),
      );
      expect(result).toMatchObject({ id: CAT_ID_1, name: 'Electronics', slug: 'electronics' });
    });

    it('throws CategoryAlreadyExistsException when category with same name exists under root', async () => {
      mockCategoryRepository.findFirst.mockResolvedValue(baseCategory);

      await expect(service.create(dto)).rejects.toThrow(CategoryAlreadyExistsException);
      expect(mockCategoryRepository.create).not.toHaveBeenCalled();
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    const dto: UpdateCategoryDto = { name: 'Consumer Electronics' };

    it('updates category successfully', async () => {
      const updatedCat = { ...baseCategory, name: 'Consumer Electronics' };
      mockCategoryRepository.findById.mockResolvedValue(baseCategory);
      mockCategoryRepository.findFirst.mockResolvedValue(null);
      mockCategoryRepository.update.mockResolvedValue(updatedCat);

      const result = await service.update(CAT_ID_1, dto);

      expect(mockCategoryRepository.update).toHaveBeenCalledWith(
        CAT_ID_1,
        expect.objectContaining({ name: 'Consumer Electronics' }),
      );
      expect(result.name).toBe('Consumer Electronics');
    });

    it('throws CategoryNotFoundException when category does not exist', async () => {
      mockCategoryRepository.findById.mockResolvedValue(null);

      await expect(service.update(NON_EXISTENT_ID, dto)).rejects.toThrow(CategoryNotFoundException);
    });

    it('throws CategorySelfReferentialException when parentId is set to catId itself', async () => {
      mockCategoryRepository.findById.mockResolvedValue(baseCategory);

      await expect(service.update(CAT_ID_1, { parentId: CAT_ID_1 })).rejects.toThrow(
        CategorySelfReferentialException,
      );
    });
  });

  // ─── getAllCategories ────────────────────────────────────────────────────────

  describe('getAllCategories', () => {
    it('returns paginated categories with metadata', async () => {
      const query: GetCategoriesQueryDto = { page: 1, limit: 10 };
      mockCategoryRepository.findPaginated.mockResolvedValue([[baseCategory, subCategory], 2]);

      const result = await service.getAllCategories(query);

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it('forces status=ACTIVE when onlyActive=true', async () => {
      const query: GetCategoriesQueryDto = { page: 1, limit: 10, status: CategoryStatus.INACTIVE };
      mockCategoryRepository.findPaginated.mockResolvedValue([[baseCategory], 1]);

      await service.getAllCategories(query, true);

      expect(mockCategoryRepository.findPaginated).toHaveBeenCalledWith(
        { status: CategoryStatus.ACTIVE },
        1,
        10,
      );
    });
  });

  // ─── getCategoryById ─────────────────────────────────────────────────────────

  describe('getCategoryById', () => {
    it('returns CategoryResponseDto with parent detail when category exists', async () => {
      const categoryWithParent = { ...subCategory, parent: baseCategory };
      mockCategoryRepository.findByIdWithParent.mockResolvedValue(categoryWithParent);

      const result = await service.getCategoryById(CAT_ID_2);

      expect(result).toMatchObject({
        id: CAT_ID_2,
        name: 'Smartphones',
        parent: expect.objectContaining({ id: CAT_ID_1 }),
      });
    });

    it('throws CategoryNotFoundException when category is missing', async () => {
      mockCategoryRepository.findByIdWithParent.mockResolvedValue(null);

      await expect(service.getCategoryById(NON_EXISTENT_ID)).rejects.toThrow(
        CategoryNotFoundException,
      );
    });

    it('throws CategoryNotFoundException when onlyActive=true and category is INACTIVE', async () => {
      mockCategoryRepository.findByIdWithParent.mockResolvedValue(inactiveCategory);

      await expect(service.getCategoryById(inactiveCategory.id, true)).rejects.toThrow(
        CategoryNotFoundException,
      );
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes existing category without children when force is false', async () => {
      mockCategoryRepository.findById.mockResolvedValue(subCategory);
      mockCategoryRepository.countChildren.mockResolvedValue(0);
      mockCategoryRepository.delete.mockResolvedValue(subCategory);

      const result = await service.delete(CAT_ID_2);

      expect(mockCategoryRepository.delete).toHaveBeenCalledWith(CAT_ID_2);
      expect(result.id).toBe(CAT_ID_2);
    });

    it('throws CategoryHasChildrenException when category has children and force is false', async () => {
      mockCategoryRepository.findById.mockResolvedValue(baseCategory);
      mockCategoryRepository.countChildren.mockResolvedValue(1);

      await expect(service.delete(CAT_ID_1)).rejects.toThrow(CategoryHasChildrenException);
      expect(mockCategoryRepository.delete).not.toHaveBeenCalled();
      expect(mockCategoryRepository.deleteTree).not.toHaveBeenCalled();
    });

    it('deletes tree when category has children and force is true', async () => {
      mockCategoryRepository.findById.mockResolvedValue(baseCategory);
      mockCategoryRepository.countChildren.mockResolvedValue(1);
      mockCategoryRepository.deleteTree.mockResolvedValue(baseCategory);

      const result = await service.delete(CAT_ID_1, true);

      expect(mockCategoryRepository.deleteTree).toHaveBeenCalledWith(CAT_ID_1);
      expect(result.id).toBe(CAT_ID_1);
    });

    it('throws CategoryNotFoundException when deleting non-existent category', async () => {
      mockCategoryRepository.findById.mockResolvedValue(null);

      await expect(service.delete(NON_EXISTENT_ID)).rejects.toThrow(CategoryNotFoundException);
    });
  });
});
