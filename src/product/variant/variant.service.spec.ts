import { Test, TestingModule } from '@nestjs/testing';
import { ProductStatus, VariantStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ProductRepository } from '../product.repository';
import { VariantRepository } from './variant.repository';
import { VariantService } from './variant.service';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { GetVariantsQueryDto } from './dto/get-variants-query.dto';
import { ProductNotFoundException } from '@/common/exceptions/product.exception';
import {
  VariantAlreadyExistsException,
  VariantInvalidPriceException,
  VariantNotFoundException,
} from '@/common/exceptions/variant.exception';

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';
const VARIANT_ID_1 = '22222222-2222-2222-2222-222222222222';
const VARIANT_ID_2 = '33333333-3333-3333-3333-333333333333';

const mockProduct = {
  id: PRODUCT_ID,
  title: 'Oak Table',
  slug: 'oak-table',
  status: ProductStatus.ACTIVE,
  description: 'Nice table',
  shortDescription: 'Oak table',
  hsnCode: '940360',
  gstRate: 18,
  brandId: null,
  categoryId: '44444444-4444-4444-4444-444444444444',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockVariant1 = {
  id: VARIANT_ID_1,
  productId: PRODUCT_ID,
  sku: 'OAK-001',
  price: 25000,
  compareAtPrice: 30000,
  currency: 'INR',
  status: VariantStatus.ACTIVE,
  isDefault: true,
  inventory: {
    id: '33333333-3333-3333-3333-333333333333',
    variantId: VARIANT_ID_1,
    quantity: 10,
    reservedQuantity: 2,
    updatedAt: new Date('2026-01-01'),
  },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockVariant2 = {
  id: VARIANT_ID_2,
  productId: PRODUCT_ID,
  sku: 'OAK-002',
  price: 35000,
  compareAtPrice: 40000,
  currency: 'INR',
  status: VariantStatus.ACTIVE,
  isDefault: false,
  inventory: {
    id: '44444444-4444-4444-4444-444444444444',
    variantId: VARIANT_ID_2,
    quantity: 0,
    reservedQuantity: 0,
    updatedAt: new Date('2026-01-02'),
  },
  createdAt: new Date('2026-01-02'),
  updatedAt: new Date('2026-01-02'),
};

describe('VariantService', () => {
  let service: VariantService;

  const mockProductRepository = {
    findById: jest.fn(),
    findFirst: jest.fn(),
  };

  const mockVariantRepository = {
    findById: jest.fn(),
    findBySku: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findPaginated: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };

  const mockPrismaService = {
    productVariant: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    mockPrismaService.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrismaService) => unknown) => fn(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VariantService,
        { provide: VariantRepository, useValue: mockVariantRepository },
        { provide: ProductRepository, useValue: mockProductRepository },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<VariantService>(VariantService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateVariantDto = {
      sku: 'OAK-001',
      price: 25000,
      compareAtPrice: 30000,
      currency: 'INR',
      status: VariantStatus.ACTIVE,
    };

    it('throws ProductNotFoundException when product does not exist', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      const error = await service.create(PRODUCT_ID, createDto).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ProductNotFoundException);
      expect(mockVariantRepository.findBySku).not.toHaveBeenCalled();
    });

    it('throws VariantAlreadyExistsException when SKU already exists', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockVariantRepository.findBySku.mockResolvedValue(mockVariant1);

      const error = await service.create(PRODUCT_ID, createDto).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VariantAlreadyExistsException);
    });

    it('throws VariantInvalidPriceException when compareAtPrice < price', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockVariantRepository.findBySku.mockResolvedValue(null);

      const invalidDto: CreateVariantDto = {
        ...createDto,
        price: 30000,
        compareAtPrice: 25000,
      };

      const error = await service.create(PRODUCT_ID, invalidDto).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VariantInvalidPriceException);
    });

    it('automatically marks first variant as default true and computes availability', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockVariantRepository.findBySku.mockResolvedValue(null);
      mockVariantRepository.count.mockResolvedValue(0);
      mockPrismaService.productVariant.create.mockResolvedValue(mockVariant1);

      const result = await service.create(PRODUCT_ID, createDto);

      expect(mockVariantRepository.count).toHaveBeenCalledWith({ productId: PRODUCT_ID });
      expect(mockPrismaService.productVariant.create).toHaveBeenCalledWith({
        data: {
          isDefault: true,
          productId: PRODUCT_ID,
          sku: 'OAK-001',
          price: 25000,
          compareAtPrice: 30000,
          currency: 'INR',
          status: VariantStatus.ACTIVE,
          inventory: {
            create: {
              quantity: 0,
              reservedQuantity: 0,
            },
          },
        },
        include: { inventory: true },
      });
      expect(result.id).toBe(VARIANT_ID_1);
      expect(result.isDefault).toBe(true);
      expect(result.availability).toEqual({
        status: 'IN_STOCK',
        quantity: 8, // 10 - 2
      });
    });

    it('sets isDefault: false for subsequent variants when not specified', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockVariantRepository.findBySku.mockResolvedValue(null);
      mockVariantRepository.count.mockResolvedValue(1);
      mockPrismaService.productVariant.create.mockResolvedValue(mockVariant2);

      const result = await service.create(PRODUCT_ID, {
        sku: 'OAK-002',
        price: 35000,
      });

      expect(mockPrismaService.productVariant.create).toHaveBeenCalledWith({
        data: {
          isDefault: false,
          productId: PRODUCT_ID,
          sku: 'OAK-002',
          price: 35000,
          compareAtPrice: null,
          currency: 'INR',
          status: VariantStatus.ACTIVE,
          inventory: {
            create: {
              quantity: 0,
              reservedQuantity: 0,
            },
          },
        },
        include: { inventory: true },
      });
      expect(result.isDefault).toBe(false);
      expect(result.availability).toEqual({
        status: 'OUT_OF_STOCK',
        quantity: 0,
      });
    });

    it('unsets other default variants when a subsequent variant is created with isDefault: true', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockVariantRepository.findBySku.mockResolvedValue(null);
      mockVariantRepository.count.mockResolvedValue(1);
      mockPrismaService.productVariant.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.productVariant.create.mockResolvedValue({
        ...mockVariant2,
        isDefault: true,
      });

      const result = await service.create(PRODUCT_ID, {
        sku: 'OAK-002',
        price: 35000,
        isDefault: true,
      });

      expect(mockPrismaService.productVariant.updateMany).toHaveBeenCalledWith({
        where: { productId: PRODUCT_ID, isDefault: true },
        data: { isDefault: false },
      });
      expect(mockPrismaService.productVariant.create).toHaveBeenCalledWith({
        data: {
          isDefault: true,
          productId: PRODUCT_ID,
          sku: 'OAK-002',
          price: 35000,
          compareAtPrice: null,
          currency: 'INR',
          status: VariantStatus.ACTIVE,
          inventory: {
            create: {
              quantity: 0,
              reservedQuantity: 0,
            },
          },
        },
        include: { inventory: true },
      });
      expect(result.isDefault).toBe(true);
    });
  });

  describe('update', () => {
    const updateDto: UpdateVariantDto = {
      price: 26000,
      compareAtPrice: 32000,
    };

    it('throws ProductNotFoundException when product does not exist', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      const error = await service
        .update(PRODUCT_ID, VARIANT_ID_1, updateDto)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ProductNotFoundException);
    });

    it('throws VariantNotFoundException when variant does not exist', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockVariantRepository.findById.mockResolvedValue(null);

      const error = await service
        .update(PRODUCT_ID, VARIANT_ID_1, updateDto)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VariantNotFoundException);
    });

    it('throws VariantAlreadyExistsException if updated SKU is taken by another variant', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockVariantRepository.findById.mockResolvedValue(mockVariant1);
      mockVariantRepository.findBySku.mockResolvedValue({
        ...mockVariant2,
        id: 'different-id',
      });

      const error = await service
        .update(PRODUCT_ID, VARIANT_ID_1, { sku: 'OAK-002' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VariantAlreadyExistsException);
    });

    it('throws VariantInvalidPriceException when compareAtPrice < effective price', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockVariantRepository.findById.mockResolvedValue(mockVariant1); // price: 25000

      const error = await service
        .update(PRODUCT_ID, VARIANT_ID_1, { compareAtPrice: 20000 })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VariantInvalidPriceException);
    });

    it('updates variant and returns updated response with availability', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockVariantRepository.findById.mockResolvedValue(mockVariant1);
      mockPrismaService.productVariant.update.mockResolvedValue({
        ...mockVariant1,
        price: 26000,
        compareAtPrice: 32000,
      });

      const result = await service.update(PRODUCT_ID, VARIANT_ID_1, updateDto);

      expect(mockPrismaService.productVariant.update).toHaveBeenCalledWith({
        where: { id: VARIANT_ID_1 },
        data: {
          price: 26000,
          compareAtPrice: 32000,
          isDefault: true,
        },
        include: { inventory: true },
      });
      expect(result.price).toBe(26000);
      expect(result.availability).toEqual({
        status: 'IN_STOCK',
        quantity: 8,
      });
    });

    it('automatically promotes another active variant to default when default variant becomes DISCONTINUED', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockVariantRepository.findById.mockResolvedValue(mockVariant1); // isDefault: true
      mockPrismaService.productVariant.findFirst.mockResolvedValue(mockVariant2); // next active variant
      mockPrismaService.productVariant.update.mockResolvedValue({
        ...mockVariant1,
        status: VariantStatus.DISCONTINUED,
        isDefault: false,
      });

      const result = await service.update(PRODUCT_ID, VARIANT_ID_1, {
        status: VariantStatus.DISCONTINUED,
      });

      expect(mockPrismaService.productVariant.findFirst).toHaveBeenCalledWith({
        where: {
          productId: PRODUCT_ID,
          id: { not: VARIANT_ID_1 },
          status: VariantStatus.ACTIVE,
        },
        orderBy: { createdAt: 'asc' },
      });
      expect(mockPrismaService.productVariant.update).toHaveBeenCalledWith({
        where: { id: VARIANT_ID_2 },
        data: { isDefault: true },
      });
      expect(result.availability).toEqual({
        status: 'DISCONTINUED',
        quantity: 0,
      });
    });

    it('unsets other variants when isDefault is updated to true', async () => {
      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockVariantRepository.findById.mockResolvedValue(mockVariant2); // isDefault: false
      mockPrismaService.productVariant.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.productVariant.update.mockResolvedValue({
        ...mockVariant2,
        isDefault: true,
      });

      const result = await service.update(PRODUCT_ID, VARIANT_ID_2, {
        isDefault: true,
      });

      expect(mockPrismaService.productVariant.updateMany).toHaveBeenCalledWith({
        where: { productId: PRODUCT_ID, id: { not: VARIANT_ID_2 }, isDefault: true },
        data: { isDefault: false },
      });
      expect(result.isDefault).toBe(true);
    });
  });

  describe('getAllVariants', () => {
    const query: GetVariantsQueryDto = { page: 1, limit: 10 };

    it('returns all variants for admin without filtering out hidden or discontinued', async () => {
      mockProductRepository.findFirst.mockResolvedValue(mockProduct);
      mockVariantRepository.findPaginated.mockResolvedValue([[mockVariant1, mockVariant2], 2]);

      const result = await service.getAllVariants(PRODUCT_ID, query, false);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(mockVariantRepository.findPaginated).toHaveBeenCalledWith(
        { productId: PRODUCT_ID },
        1,
        10,
      );
    });

    it('filters active variants for public calls', async () => {
      mockProductRepository.findFirst.mockResolvedValue(mockProduct);
      mockVariantRepository.findPaginated.mockResolvedValue([[mockVariant1], 1]);

      const result = await service.getAllVariants(PRODUCT_ID, query, true);

      expect(result.data).toHaveLength(1);
      expect(mockVariantRepository.findPaginated).toHaveBeenCalledWith(
        {
          productId: PRODUCT_ID,
          status: VariantStatus.ACTIVE,
        },
        1,
        10,
      );
    });

    it('throws ProductNotFoundException if public call is made on product with no visible variants', async () => {
      mockProductRepository.findFirst.mockResolvedValue(null);

      const error = await service.getAllVariants(PRODUCT_ID, query, true).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ProductNotFoundException);
    });
  });

  describe('getVariantById', () => {
    it('returns variant with availability when found', async () => {
      mockProductRepository.findFirst.mockResolvedValue(mockProduct);
      mockVariantRepository.findById.mockResolvedValue(mockVariant1);

      const result = await service.getVariantById(PRODUCT_ID, VARIANT_ID_1);

      expect(result.id).toBe(VARIANT_ID_1);
      expect(result.sku).toBe('OAK-001');
      expect(result.availability).toEqual({
        status: 'IN_STOCK',
        quantity: 8,
      });
    });

    it('throws VariantNotFoundException if variant does not exist', async () => {
      mockProductRepository.findFirst.mockResolvedValue(mockProduct);
      mockVariantRepository.findById.mockResolvedValue(null);

      const error = await service
        .getVariantById(PRODUCT_ID, 'non-existent-id')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VariantNotFoundException);
    });

    it('throws VariantNotFoundException if public call views a hidden variant', async () => {
      mockProductRepository.findFirst.mockResolvedValue(mockProduct);
      mockVariantRepository.findById.mockResolvedValue({
        ...mockVariant1,
        status: VariantStatus.HIDDEN,
      });

      const error = await service
        .getVariantById(PRODUCT_ID, VARIANT_ID_1, true)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(VariantNotFoundException);
    });
  });
});
