import { Test, TestingModule } from '@nestjs/testing';
import { VariantStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { VariantRepository } from './variant.repository';

const PRODUCT_ID_1 = '11111111-1111-1111-1111-111111111111';
const VARIANT_ID_1 = '22222222-2222-2222-2222-222222222222';

const mockVariant = {
  id: VARIANT_ID_1,
  productId: PRODUCT_ID_1,
  sku: 'OAK-TABLE-001',
  price: 25000,
  compareAtPrice: 30000,
  currency: 'INR',
  status: VariantStatus.ACTIVE,
  isDefault: true,
  inventory: {
    id: '33333333-3333-3333-3333-333333333333',
    variantId: VARIANT_ID_1,
    quantity: 100,
    reservedQuantity: 10,
    updatedAt: new Date('2026-01-01'),
  },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPrismaService = {
  productVariant: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('VariantRepository', () => {
  let repository: VariantRepository;

  beforeEach(async () => {
    mockPrismaService.$transaction.mockImplementation((arg: unknown) =>
      Array.isArray(arg)
        ? Promise.all(arg)
        : (arg as (tx: typeof mockPrismaService) => unknown)(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [VariantRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<VariantRepository>(VariantRepository);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  const expectedVariantInclude = {
    inventory: true,
    attributeValues: {
      include: {
        definition: true,
      },
      orderBy: { createdAt: 'asc' },
    },
  };

  describe('findById', () => {
    it('delegates to prisma.productVariant.findUnique with inventory included', async () => {
      mockPrismaService.productVariant.findUnique.mockResolvedValue(mockVariant);

      const result = await repository.findById(VARIANT_ID_1);

      expect(mockPrismaService.productVariant.findUnique).toHaveBeenCalledWith({
        where: { id: VARIANT_ID_1 },
        include: expectedVariantInclude,
      });
      expect(result).toBe(mockVariant);
    });
  });

  describe('findBySku', () => {
    it('delegates to prisma.productVariant.findUnique with inventory included', async () => {
      mockPrismaService.productVariant.findUnique.mockResolvedValue(mockVariant);

      const result = await repository.findBySku('OAK-TABLE-001');

      expect(mockPrismaService.productVariant.findUnique).toHaveBeenCalledWith({
        where: { sku: 'OAK-TABLE-001' },
        include: expectedVariantInclude,
      });
      expect(result).toBe(mockVariant);
    });
  });

  describe('findFirst', () => {
    it('delegates to prisma.productVariant.findFirst with inventory included', async () => {
      const where = { productId: PRODUCT_ID_1, isDefault: true };
      mockPrismaService.productVariant.findFirst.mockResolvedValue(mockVariant);

      const result = await repository.findFirst(where);

      expect(mockPrismaService.productVariant.findFirst).toHaveBeenCalledWith({
        where,
        include: expectedVariantInclude,
      });
      expect(result).toBe(mockVariant);
    });
  });

  describe('findMany', () => {
    it('delegates to prisma.productVariant.findMany with inventory included', async () => {
      const where = { productId: PRODUCT_ID_1 };
      mockPrismaService.productVariant.findMany.mockResolvedValue([mockVariant]);

      const result = await repository.findMany(where);

      expect(mockPrismaService.productVariant.findMany).toHaveBeenCalledWith({
        where,
        orderBy: { createdAt: 'asc' },
        include: expectedVariantInclude,
      });
      expect(result).toEqual([mockVariant]);
    });
  });

  describe('count', () => {
    it('delegates to prisma.productVariant.count', async () => {
      mockPrismaService.productVariant.count.mockResolvedValue(1);

      const result = await repository.count({ productId: PRODUCT_ID_1 });

      expect(mockPrismaService.productVariant.count).toHaveBeenCalledWith({
        where: { productId: PRODUCT_ID_1 },
      });
      expect(result).toBe(1);
    });
  });

  describe('findPaginated', () => {
    it('executes findMany and count in transaction with inventory included', async () => {
      mockPrismaService.productVariant.findMany.mockResolvedValue([mockVariant]);
      mockPrismaService.productVariant.count.mockResolvedValue(1);

      const where = { productId: PRODUCT_ID_1 };
      const [data, total] = await repository.findPaginated(where, 1, 10);

      expect(data).toEqual([mockVariant]);
      expect(total).toBe(1);
    });
  });

  describe('create', () => {
    it('delegates to prisma.productVariant.create with inventory included', async () => {
      const data = {
        productId: PRODUCT_ID_1,
        sku: 'OAK-TABLE-001',
        price: 25000,
      };
      mockPrismaService.productVariant.create.mockResolvedValue(mockVariant);

      const result = await repository.create(data);

      expect(mockPrismaService.productVariant.create).toHaveBeenCalledWith({
        data,
        include: { inventory: true },
      });
      expect(result).toBe(mockVariant);
    });
  });

  describe('update', () => {
    it('delegates to prisma.productVariant.update with inventory included', async () => {
      const data = { price: 26000 };
      mockPrismaService.productVariant.update.mockResolvedValue(mockVariant);

      const result = await repository.update(VARIANT_ID_1, data);

      expect(mockPrismaService.productVariant.update).toHaveBeenCalledWith({
        where: { id: VARIANT_ID_1 },
        data,
        include: { inventory: true },
      });
      expect(result).toBe(mockVariant);
    });
  });

  describe('updateMany', () => {
    it('delegates to prisma.productVariant.updateMany', async () => {
      const where = { productId: PRODUCT_ID_1, isDefault: true };
      const data = { isDefault: false };
      mockPrismaService.productVariant.updateMany.mockResolvedValue({ count: 1 });

      const result = await repository.updateMany(where, data);

      expect(mockPrismaService.productVariant.updateMany).toHaveBeenCalledWith({
        where,
        data,
      });
      expect(result).toEqual({ count: 1 });
    });
  });

  describe('delete', () => {
    it('delegates to prisma.productVariant.delete', async () => {
      mockPrismaService.productVariant.delete.mockResolvedValue(mockVariant);

      const result = await repository.delete(VARIANT_ID_1);

      expect(mockPrismaService.productVariant.delete).toHaveBeenCalledWith({
        where: { id: VARIANT_ID_1 },
      });
      expect(result).toBe(mockVariant);
    });
  });
});
