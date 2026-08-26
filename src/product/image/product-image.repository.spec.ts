import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { ProductImageRepository } from './product-image.repository';

const PRODUCT_ID_1 = '11111111-1111-1111-1111-111111111111';
const IMAGE_ID_1 = '22222222-2222-2222-2222-222222222222';
const IMAGE_ID_2 = '33333333-3333-3333-3333-333333333333';

const mockImage = {
  id: IMAGE_ID_1,
  productId: PRODUCT_ID_1,
  variantId: null,
  storageKey: 'products/111/images/img1.webp',
  altText: 'Front Image',
  sortOrder: 0,
  isPrimary: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPrismaService = {
  productImage: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ProductImageRepository', () => {
  let repository: ProductImageRepository;

  beforeEach(async () => {
    mockPrismaService.$transaction.mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof mockPrismaService) => unknown)(mockPrismaService);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductImageRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<ProductImageRepository>(ProductImageRepository);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findById', () => {
    it('delegates to prisma.productImage.findUnique', async () => {
      mockPrismaService.productImage.findUnique.mockResolvedValue(mockImage);

      const result = await repository.findById(IMAGE_ID_1);

      expect(mockPrismaService.productImage.findUnique).toHaveBeenCalledWith({
        where: { id: IMAGE_ID_1 },
      });
      expect(result).toBe(mockImage);
    });
  });

  describe('findFirst', () => {
    it('delegates to prisma.productImage.findFirst', async () => {
      const where = { productId: PRODUCT_ID_1, isPrimary: true };
      mockPrismaService.productImage.findFirst.mockResolvedValue(mockImage);

      const result = await repository.findFirst(where);

      expect(mockPrismaService.productImage.findFirst).toHaveBeenCalledWith({ where });
      expect(result).toBe(mockImage);
    });
  });

  describe('findMany', () => {
    it('delegates to prisma.productImage.findMany with default ordering', async () => {
      const where = { productId: PRODUCT_ID_1 };
      mockPrismaService.productImage.findMany.mockResolvedValue([mockImage]);

      const result = await repository.findMany(where);

      expect(mockPrismaService.productImage.findMany).toHaveBeenCalledWith({
        where,
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      expect(result).toEqual([mockImage]);
    });
  });

  describe('create', () => {
    it('delegates to prisma.productImage.create', async () => {
      const data = {
        productId: PRODUCT_ID_1,
        storageKey: 'products/111/images/img1.webp',
      };
      mockPrismaService.productImage.create.mockResolvedValue(mockImage);

      const result = await repository.create(data);

      expect(mockPrismaService.productImage.create).toHaveBeenCalledWith({ data });
      expect(result).toBe(mockImage);
    });
  });

  describe('createMany', () => {
    it('resets existing primary images if hasPrimary is true and creates records in transaction', async () => {
      const items = [
        { storageKey: 'products/111/images/img1.webp', isPrimary: true },
        { storageKey: 'products/111/images/img2.webp', isPrimary: false },
      ];
      mockPrismaService.productImage.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.productImage.create
        .mockResolvedValueOnce({ ...mockImage, id: IMAGE_ID_1 })
        .mockResolvedValueOnce({ ...mockImage, id: IMAGE_ID_2, isPrimary: false });

      const result = await repository.createMany(PRODUCT_ID_1, items, true);

      expect(mockPrismaService.productImage.updateMany).toHaveBeenCalledWith({
        where: { productId: PRODUCT_ID_1 },
        data: { isPrimary: false },
      });
      expect(mockPrismaService.productImage.create).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });

    it('does not reset existing primary if hasPrimary is false', async () => {
      const items = [{ storageKey: 'products/111/images/img1.webp', isPrimary: false }];
      mockPrismaService.productImage.create.mockResolvedValueOnce(mockImage);

      const result = await repository.createMany(PRODUCT_ID_1, items, false);

      expect(mockPrismaService.productImage.updateMany).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('setPrimary', () => {
    it('sets target image as primary and resets other product images in transaction', async () => {
      mockPrismaService.productImage.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.productImage.update.mockResolvedValue({ ...mockImage, isPrimary: true });

      const result = await repository.setPrimary(PRODUCT_ID_1, IMAGE_ID_1);

      expect(mockPrismaService.productImage.updateMany).toHaveBeenCalledWith({
        where: {
          productId: PRODUCT_ID_1,
          id: { not: IMAGE_ID_1 },
        },
        data: { isPrimary: false },
      });
      expect(mockPrismaService.productImage.update).toHaveBeenCalledWith({
        where: { id: IMAGE_ID_1 },
        data: { isPrimary: true },
      });
      expect(result.isPrimary).toBe(true);
    });
  });

  describe('deleteManyByIds', () => {
    it('finds existing images by ids and deletes them in transaction', async () => {
      mockPrismaService.productImage.findMany.mockResolvedValue([mockImage]);
      mockPrismaService.productImage.deleteMany.mockResolvedValue({ count: 1 });

      const result = await repository.deleteManyByIds(PRODUCT_ID_1, [IMAGE_ID_1]);

      expect(mockPrismaService.productImage.findMany).toHaveBeenCalledWith({
        where: {
          productId: PRODUCT_ID_1,
          id: { in: [IMAGE_ID_1] },
        },
      });
      expect(mockPrismaService.productImage.deleteMany).toHaveBeenCalledWith({
        where: {
          productId: PRODUCT_ID_1,
          id: { in: [IMAGE_ID_1] },
        },
      });
      expect(result).toEqual([mockImage]);
    });

    it('returns empty array when no matching images are found', async () => {
      mockPrismaService.productImage.findMany.mockResolvedValue([]);

      const result = await repository.deleteManyByIds(PRODUCT_ID_1, [IMAGE_ID_1]);

      expect(mockPrismaService.productImage.deleteMany).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});
