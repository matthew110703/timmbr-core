import { Test, TestingModule } from '@nestjs/testing';
import { CategoryStatus } from '@prisma/client';
import { CategoryService } from './category.service';
import { CategoryRepository } from './category.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { GetCategoriesQueryDto } from './dto/get-categories-query.dto';
import {
  CategoryAlreadyExistsException,
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

const mockCategoryRepository = {
  findById: jest.fn(),
  findByIdWithParent: jest.fn(),
  findFirst: jest.fn(),
  findAllSortedByName: jest.fn(),
  findPaginated: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
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

      expect(mockCategoryRepository.findById).toHaveBeenCalledWith(CAT_ID_1);
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(CAT_ID_2);
    });

    it('throws CategoryNotFoundException when invalid rootParentId is provided', async () => {
      mockCategoryRepository.findById.mockResolvedValue(null);

      await expect(service.getCategoryTree(NON_EXISTENT_ID)).rejects.toThrow(
        CategoryNotFoundException,
      );
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateCategoryDto = {
      name: 'Electronics',
      description: 'Electronic devices',
      logoUrl: 'http://example.com/logo.png',
      status: CategoryStatus.ACTIVE,
    };

    it('creates a category and returns mapped response', async () => {
      mockCategoryRepository.findFirst.mockResolvedValue(null);
      mockCategoryRepository.create.mockResolvedValue(baseCategory);

      const result = await service.create(dto);

      expect(mockCategoryRepository.findFirst).toHaveBeenCalledWith({
        name: dto.name,
      });
      expect(mockCategoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: dto.name,
          slug: 'electronics',
        }),
      );
      expect(result).toMatchObject({ id: CAT_ID_1, name: 'Electronics' });
    });

    it('throws CategoryAlreadyExistsException when duplicate root category exists', async () => {
      mockCategoryRepository.findFirst.mockResolvedValue(baseCategory);

      await expect(service.create(dto)).rejects.toThrow(CategoryAlreadyExistsException);
    });

    it('throws CategoryAlreadyExistsException with parent details when duplicate child category exists', async () => {
      const childDto: CreateCategoryDto = {
        ...dto,
        parentId: CAT_ID_1,
      };
      mockCategoryRepository.findFirst.mockResolvedValue(subCategory);

      await expect(service.create(childDto)).rejects.toThrow(CategoryAlreadyExistsException);
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    const dto: UpdateCategoryDto = { name: 'Updated Electronics' };

    it('updates a category successfully', async () => {
      const updatedCategory = {
        ...baseCategory,
        name: 'Updated Electronics',
        slug: 'updated-electronics',
      };
      mockCategoryRepository.findById.mockResolvedValue(baseCategory);
      mockCategoryRepository.findFirst.mockResolvedValue(null);
      mockCategoryRepository.update.mockResolvedValue(updatedCategory);

      const result = await service.update(CAT_ID_1, dto);

      expect(mockCategoryRepository.update).toHaveBeenCalledWith(
        CAT_ID_1,
        expect.objectContaining({ name: 'Updated Electronics' }),
      );
      expect(result.name).toBe('Updated Electronics');
    });

    it('throws CategoryNotFoundException if category to update does not exist', async () => {
      mockCategoryRepository.findById.mockResolvedValue(null);

      await expect(service.update(NON_EXISTENT_ID, dto)).rejects.toThrow(CategoryNotFoundException);
    });

    it('throws CategorySelfReferentialException when setting parentId to self', async () => {
      mockCategoryRepository.findById.mockResolvedValue(baseCategory);

      await expect(service.update(CAT_ID_1, { parentId: CAT_ID_1 })).rejects.toThrow(
        CategorySelfReferentialException,
      );
    });

    it('throws CategoryAlreadyExistsException when updated name collides with another category', async () => {
      mockCategoryRepository.findById.mockResolvedValue(baseCategory);
      mockCategoryRepository.findFirst.mockResolvedValue(subCategory);

      await expect(service.update(CAT_ID_1, { name: 'Smartphones' })).rejects.toThrow(
        CategoryAlreadyExistsException,
      );
    });
  });

  // ─── getAllCategories ────────────────────────────────────────────────────────

  describe('getAllCategories', () => {
    it('returns paginated categories list with default pagination values', async () => {
      mockCategoryRepository.findPaginated.mockResolvedValue([[baseCategory], 1]);

      const query: GetCategoriesQueryDto = {};
      const result = await service.getAllCategories(query);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it('filters by status and parentId when query parameters are supplied', async () => {
      mockCategoryRepository.findPaginated.mockResolvedValue([[], 0]);

      const query: GetCategoriesQueryDto = {
        status: CategoryStatus.ACTIVE,
        parentId: CAT_ID_1,
        page: 1,
        limit: 5,
      };

      await service.getAllCategories(query);

      expect(mockCategoryRepository.findPaginated).toHaveBeenCalledWith(
        { status: CategoryStatus.ACTIVE, parentId: CAT_ID_1 },
        1,
        5,
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
  });

  // ─── delete ──────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes existing category and returns mapped response', async () => {
      mockCategoryRepository.findById.mockResolvedValue(baseCategory);
      mockCategoryRepository.delete.mockResolvedValue(baseCategory);

      const result = await service.delete(CAT_ID_1);

      expect(mockCategoryRepository.delete).toHaveBeenCalledWith(CAT_ID_1);
      expect(result.id).toBe(CAT_ID_1);
    });

    it('throws CategoryNotFoundException when deleting non-existent category', async () => {
      mockCategoryRepository.findById.mockResolvedValue(null);

      await expect(service.delete(NON_EXISTENT_ID)).rejects.toThrow(CategoryNotFoundException);
    });
  });
});
