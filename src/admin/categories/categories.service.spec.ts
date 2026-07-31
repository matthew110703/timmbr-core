import { Test, TestingModule } from '@nestjs/testing';
import { CategoryStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CategoriesService } from './categories.service';
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

const mockPrismaService = {
  category: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    mockPrismaService.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrismaService) => unknown) => fn(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getCategoryTree ─────────────────────────────────────────────────────────

  describe('getCategoryTree', () => {
    it('returns the full root category tree when no rootParentId is provided', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([baseCategory, subCategory]);

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
      mockPrismaService.category.findUnique.mockResolvedValue(baseCategory);
      mockPrismaService.category.findMany.mockResolvedValue([baseCategory, subCategory]);

      const tree = await service.getCategoryTree(CAT_ID_1);

      expect(mockPrismaService.category.findUnique).toHaveBeenCalledWith({
        where: { id: CAT_ID_1 },
      });
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(CAT_ID_2);
    });

    it('throws CategoryNotFoundException when invalid rootParentId is provided', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

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
      mockPrismaService.category.findFirst.mockResolvedValue(null);
      mockPrismaService.category.create.mockResolvedValue(baseCategory);

      const result = await service.create(dto);

      expect(mockPrismaService.category.findFirst).toHaveBeenCalledWith({
        where: { name: dto.name },
      });
      expect(mockPrismaService.category.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: dto.name,
          slug: 'electronics',
        }),
      });
      expect(result).toMatchObject({ id: CAT_ID_1, name: 'Electronics' });
    });

    it('throws CategoryAlreadyExistsException when duplicate root category exists', async () => {
      mockPrismaService.category.findFirst.mockResolvedValue(baseCategory);

      await expect(service.create(dto)).rejects.toThrow(CategoryAlreadyExistsException);
    });

    it('throws CategoryAlreadyExistsException with parent details when duplicate child category exists', async () => {
      const childDto: CreateCategoryDto = {
        ...dto,
        parentId: CAT_ID_1,
      };
      mockPrismaService.category.findFirst.mockResolvedValue(subCategory);

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
      mockPrismaService.category.findUnique.mockResolvedValue(baseCategory);
      mockPrismaService.category.findFirst.mockResolvedValue(null);
      mockPrismaService.category.update.mockResolvedValue(updatedCategory);

      const result = await service.update(CAT_ID_1, dto);

      expect(mockPrismaService.category.update).toHaveBeenCalledWith({
        where: { id: CAT_ID_1 },
        data: expect.objectContaining({ name: 'Updated Electronics' }),
      });
      expect(result.name).toBe('Updated Electronics');
    });

    it('throws CategoryNotFoundException if category to update does not exist', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.update(NON_EXISTENT_ID, dto)).rejects.toThrow(CategoryNotFoundException);
    });

    it('throws CategorySelfReferentialException when setting parentId to self', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(baseCategory);

      await expect(service.update(CAT_ID_1, { parentId: CAT_ID_1 })).rejects.toThrow(
        CategorySelfReferentialException,
      );
    });

    it('throws CategoryAlreadyExistsException when updated name collides with another category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(baseCategory);
      mockPrismaService.category.findFirst.mockResolvedValue(subCategory);

      await expect(service.update(CAT_ID_1, { name: 'Smartphones' })).rejects.toThrow(
        CategoryAlreadyExistsException,
      );
    });
  });

  // ─── getAllCategories ────────────────────────────────────────────────────────

  describe('getAllCategories', () => {
    it('returns paginated categories list with default pagination values', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([baseCategory]);
      mockPrismaService.category.count.mockResolvedValue(1);

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
      mockPrismaService.category.findMany.mockResolvedValue([]);
      mockPrismaService.category.count.mockResolvedValue(0);

      const query: GetCategoriesQueryDto = {
        status: CategoryStatus.ACTIVE,
        parentId: CAT_ID_1,
        page: 1,
        limit: 5,
      };

      await service.getAllCategories(query);

      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: CategoryStatus.ACTIVE, parentId: CAT_ID_1 },
          skip: 0,
          take: 5,
        }),
      );
    });
  });

  // ─── getCategoryById ─────────────────────────────────────────────────────────

  describe('getCategoryById', () => {
    it('returns CategoryResponseDto with parent detail when category exists', async () => {
      const categoryWithParent = { ...subCategory, parent: baseCategory };
      mockPrismaService.category.findUnique.mockResolvedValue(categoryWithParent);

      const result = await service.getCategoryById(CAT_ID_2);

      expect(result).toMatchObject({
        id: CAT_ID_2,
        name: 'Smartphones',
        parent: expect.objectContaining({ id: CAT_ID_1 }),
      });
    });

    it('throws CategoryNotFoundException when category is missing', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.getCategoryById(NON_EXISTENT_ID)).rejects.toThrow(
        CategoryNotFoundException,
      );
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes existing category and returns mapped response', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(baseCategory);
      mockPrismaService.category.delete.mockResolvedValue(baseCategory);

      const result = await service.delete(CAT_ID_1);

      expect(mockPrismaService.category.delete).toHaveBeenCalledWith({
        where: { id: CAT_ID_1 },
      });
      expect(result.id).toBe(CAT_ID_1);
    });

    it('throws CategoryNotFoundException when deleting non-existent category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.delete(NON_EXISTENT_ID)).rejects.toThrow(CategoryNotFoundException);
    });
  });
});
