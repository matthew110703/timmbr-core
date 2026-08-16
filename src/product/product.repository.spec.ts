import { Test, TestingModule } from '@nestjs/testing';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ProductRepository } from './product.repository';

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

const mockPrismaService = {
  product: {
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

describe('ProductRepository', () => {
  let repository: ProductRepository;

  beforeEach(async () => {
    mockPrismaService.$transaction.mockImplementation((arg: unknown) =>
      Array.isArray(arg)
        ? Promise.all(arg)
        : (arg as (tx: typeof mockPrismaService) => unknown)(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<ProductRepository>(ProductRepository);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findById', () => {
    it('delegates to prisma.product.findUnique', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await repository.findById(PRODUCT_ID_1);

      expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID_1 },
      });
      expect(result).toBe(mockProduct);
    });
  });

  describe('findBySlug', () => {
    it('delegates to prisma.product.findUnique', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await repository.findBySlug('oak-dining-table');

      expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
        where: { slug: 'oak-dining-table' },
      });
      expect(result).toBe(mockProduct);
    });
  });

  describe('findFirst', () => {
    it('delegates to prisma.product.findFirst', async () => {
      const where = { title: 'Oak Dining Table' };
      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);

      const result = await repository.findFirst(where);

      expect(mockPrismaService.product.findFirst).toHaveBeenCalledWith({ where });
      expect(result).toBe(mockProduct);
    });
  });

  describe('findPaginated', () => {
    it('executes findMany and count in transaction', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);
      mockPrismaService.product.count.mockResolvedValue(1);

      const where = { status: ProductStatus.ACTIVE };
      const [data, total] = await repository.findPaginated(where, 1, 10);

      expect(data).toEqual([mockProduct]);
      expect(total).toBe(1);
    });
  });

  describe('create', () => {
    it('delegates to prisma.product.create', async () => {
      const data = {
        title: 'Oak Dining Table',
        slug: 'oak-dining-table',
        shortDescription: 'Solid oak table',
        categoryId: CATEGORY_ID_1,
      };
      mockPrismaService.product.create.mockResolvedValue(mockProduct);

      const result = await repository.create(data);

      expect(mockPrismaService.product.create).toHaveBeenCalledWith({ data });
      expect(result).toBe(mockProduct);
    });
  });

  describe('update', () => {
    it('delegates to prisma.product.update', async () => {
      const data = { title: 'Oak Dining Table Updated' };
      mockPrismaService.product.update.mockResolvedValue(mockProduct);

      const result = await repository.update(PRODUCT_ID_1, data);

      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID_1 },
        data,
      });
      expect(result).toBe(mockProduct);
    });
  });

  describe('delete', () => {
    it('delegates to prisma.product.delete', async () => {
      mockPrismaService.product.delete.mockResolvedValue(mockProduct);

      const result = await repository.delete(PRODUCT_ID_1);

      expect(mockPrismaService.product.delete).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID_1 },
      });
      expect(result).toBe(mockProduct);
    });
  });
});
