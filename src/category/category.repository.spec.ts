import { Test, TestingModule } from '@nestjs/testing';
import { CategoryStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CategoryRepository } from './category.repository';

const CAT_ID_1 = '11111111-1111-1111-1111-111111111111';
const CAT_ID_2 = '22222222-2222-2222-2222-222222222222';

const mockCategory = {
  id: CAT_ID_1,
  name: 'Electronics',
  slug: 'electronics',
  status: CategoryStatus.ACTIVE,
  description: 'Electronic products',
  logoUrl: null,
  parentId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockCategoryWithParent = {
  ...mockCategory,
  id: CAT_ID_2,
  name: 'Smartphones',
  parentId: CAT_ID_1,
  parent: mockCategory,
};

const mockPrismaService = {
  category: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('CategoryRepository', () => {
  let repository: CategoryRepository;

  beforeEach(async () => {
    mockPrismaService.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrismaService) => unknown) => fn(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoryRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<CategoryRepository>(CategoryRepository);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findById', () => {
    it('delegates to prisma.category.findUnique', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);

      const result = await repository.findById(CAT_ID_1);

      expect(mockPrismaService.category.findUnique).toHaveBeenCalledWith({
        where: { id: CAT_ID_1 },
      });
      expect(result).toBe(mockCategory);
    });
  });

  describe('findByIdWithParent', () => {
    it('delegates to prisma.category.findUnique with parent include', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategoryWithParent);

      const result = await repository.findByIdWithParent(CAT_ID_2);

      expect(mockPrismaService.category.findUnique).toHaveBeenCalledWith({
        where: { id: CAT_ID_2 },
        include: { parent: true },
      });
      expect(result).toBe(mockCategoryWithParent);
    });
  });

  describe('findFirst', () => {
    it('delegates to prisma.category.findFirst', async () => {
      const where = { name: 'Electronics' };
      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);

      const result = await repository.findFirst(where);

      expect(mockPrismaService.category.findFirst).toHaveBeenCalledWith({ where });
      expect(result).toBe(mockCategory);
    });
  });

  describe('findAllSortedByName', () => {
    it('delegates to prisma.category.findMany sorted by name', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([mockCategory]);

      const result = await repository.findAllSortedByName();

      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([mockCategory]);
    });
  });

  describe('findPaginated', () => {
    it('executes findMany and count in transaction', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([mockCategoryWithParent]);
      mockPrismaService.category.count.mockResolvedValue(1);

      const where = { status: CategoryStatus.ACTIVE };
      const [data, total] = await repository.findPaginated(where, 1, 10);

      expect(data).toEqual([mockCategoryWithParent]);
      expect(total).toBe(1);
    });
  });

  describe('create', () => {
    it('delegates to prisma.category.create', async () => {
      const data = { name: 'Electronics', slug: 'electronics' };
      mockPrismaService.category.create.mockResolvedValue(mockCategory);

      const result = await repository.create(data);

      expect(mockPrismaService.category.create).toHaveBeenCalledWith({ data });
      expect(result).toBe(mockCategory);
    });
  });

  describe('update', () => {
    it('delegates to prisma.category.update', async () => {
      const data = { name: 'Updated Electronics' };
      mockPrismaService.category.update.mockResolvedValue(mockCategory);

      const result = await repository.update(CAT_ID_1, data);

      expect(mockPrismaService.category.update).toHaveBeenCalledWith({
        where: { id: CAT_ID_1 },
        data,
      });
      expect(result).toBe(mockCategory);
    });
  });

  describe('delete', () => {
    it('delegates to prisma.category.delete', async () => {
      mockPrismaService.category.delete.mockResolvedValue(mockCategory);

      const result = await repository.delete(CAT_ID_1);

      expect(mockPrismaService.category.delete).toHaveBeenCalledWith({
        where: { id: CAT_ID_1 },
      });
      expect(result).toBe(mockCategory);
    });
  });
});
