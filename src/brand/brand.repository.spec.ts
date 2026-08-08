import { Test, TestingModule } from '@nestjs/testing';
import { BrandStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { BrandRepository } from './brand.repository';

const BRAND_ID_1 = '11111111-1111-1111-1111-111111111111';

const mockBrand = {
  id: BRAND_ID_1,
  name: 'Nike',
  slug: 'nike',
  status: BrandStatus.ACTIVE,
  description: 'Athletic footwear and apparel',
  logoUrl: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPrismaService = {
  brand: {
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

describe('BrandRepository', () => {
  let repository: BrandRepository;

  beforeEach(async () => {
    mockPrismaService.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrismaService) => unknown) => fn(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [BrandRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<BrandRepository>(BrandRepository);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findById', () => {
    it('delegates to prisma.brand.findUnique', async () => {
      mockPrismaService.brand.findUnique.mockResolvedValue(mockBrand);

      const result = await repository.findById(BRAND_ID_1);

      expect(mockPrismaService.brand.findUnique).toHaveBeenCalledWith({
        where: { id: BRAND_ID_1 },
      });
      expect(result).toBe(mockBrand);
    });
  });

  describe('findFirst', () => {
    it('delegates to prisma.brand.findFirst', async () => {
      const where = { name: 'Nike' };
      mockPrismaService.brand.findFirst.mockResolvedValue(mockBrand);

      const result = await repository.findFirst(where);

      expect(mockPrismaService.brand.findFirst).toHaveBeenCalledWith({ where });
      expect(result).toBe(mockBrand);
    });
  });

  describe('findPaginated', () => {
    it('executes findMany and count in transaction', async () => {
      mockPrismaService.brand.findMany.mockResolvedValue([mockBrand]);
      mockPrismaService.brand.count.mockResolvedValue(1);

      const where = { status: BrandStatus.ACTIVE };
      const [data, total] = await repository.findPaginated(where, 1, 10);

      expect(data).toEqual([mockBrand]);
      expect(total).toBe(1);
    });
  });

  describe('create', () => {
    it('delegates to prisma.brand.create', async () => {
      const data = { name: 'Nike', slug: 'nike' };
      mockPrismaService.brand.create.mockResolvedValue(mockBrand);

      const result = await repository.create(data);

      expect(mockPrismaService.brand.create).toHaveBeenCalledWith({ data });
      expect(result).toBe(mockBrand);
    });
  });

  describe('update', () => {
    it('delegates to prisma.brand.update', async () => {
      const data = { name: 'Nike Inc' };
      mockPrismaService.brand.update.mockResolvedValue(mockBrand);

      const result = await repository.update(BRAND_ID_1, data);

      expect(mockPrismaService.brand.update).toHaveBeenCalledWith({
        where: { id: BRAND_ID_1 },
        data,
      });
      expect(result).toBe(mockBrand);
    });
  });

  describe('delete', () => {
    it('delegates to prisma.brand.delete', async () => {
      mockPrismaService.brand.delete.mockResolvedValue(mockBrand);

      const result = await repository.delete(BRAND_ID_1);

      expect(mockPrismaService.brand.delete).toHaveBeenCalledWith({
        where: { id: BRAND_ID_1 },
      });
      expect(result).toBe(mockBrand);
    });
  });
});
