import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { InventoryTransactionType } from '@prisma/client';
import { InventoryRepository } from './inventory.repository';

const VARIANT_ID = '22222222-2222-2222-2222-222222222222';
const INVENTORY_ID = '33333333-3333-3333-3333-333333333333';
const TRANSACTION_ID = '44444444-4444-4444-4444-444444444444';

const mockInventory = {
  id: INVENTORY_ID,
  variantId: VARIANT_ID,
  quantity: 250,
  reservedQuantity: 10,
  updatedAt: new Date('2026-06-01T09:00:00.000Z'),
};

const mockTransaction = {
  id: TRANSACTION_ID,
  inventoryId: INVENTORY_ID,
  type: InventoryTransactionType.ADJUSTMENT,
  quantity: -5,
  quantityBefore: 250,
  quantityAfter: 245,
  reason: 'damaged_in_transit',
  referenceType: null,
  referenceId: null,
  createdBy: 'user_1',
  createdAt: new Date('2026-06-01T09:05:00.000Z'),
};

const mockPrismaService = {
  inventory: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  inventoryTransaction: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};

describe('InventoryRepository', () => {
  let repository: InventoryRepository;

  beforeEach(async () => {
    mockPrismaService.$transaction.mockImplementation((arg: unknown) =>
      Array.isArray(arg)
        ? Promise.all(arg)
        : (arg as (tx: typeof mockPrismaService) => unknown)(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [InventoryRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<InventoryRepository>(InventoryRepository);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findByVariantId', () => {
    it('delegates to prisma.inventory.findUnique', async () => {
      mockPrismaService.inventory.findUnique.mockResolvedValue(mockInventory);

      const result = await repository.findByVariantId(VARIANT_ID);

      expect(mockPrismaService.inventory.findUnique).toHaveBeenCalledWith({
        where: { variantId: VARIANT_ID },
      });
      expect(result).toBe(mockInventory);
    });
  });

  describe('findWithLock', () => {
    it('executes raw query with row-level locking', async () => {
      const mockTx = {
        $queryRaw: jest.fn().mockResolvedValue([mockInventory]),
      };

      const result = await repository.findWithLock(VARIANT_ID, mockTx as unknown as PrismaService);

      expect(mockTx.$queryRaw).toHaveBeenCalled();
      expect(result).toBe(mockInventory);
    });

    it('returns null if raw query returns empty list', async () => {
      const mockTx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
      };

      const result = await repository.findWithLock(VARIANT_ID, mockTx as unknown as PrismaService);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('delegates to prisma.inventory.create', async () => {
      const data = { variantId: VARIANT_ID, quantity: 0, reservedQuantity: 0 };
      mockPrismaService.inventory.create.mockResolvedValue(mockInventory);

      const result = await repository.create(data);

      expect(mockPrismaService.inventory.create).toHaveBeenCalledWith({ data });
      expect(result).toBe(mockInventory);
    });
  });

  describe('update', () => {
    it('delegates to prisma.inventory.update', async () => {
      const data = { quantity: 300 };
      mockPrismaService.inventory.update.mockResolvedValue({
        ...mockInventory,
        quantity: 300,
      });

      const result = await repository.update(INVENTORY_ID, data);

      expect(mockPrismaService.inventory.update).toHaveBeenCalledWith({
        where: { id: INVENTORY_ID },
        data,
      });
      expect(result.quantity).toBe(300);
    });
  });

  describe('createTransaction', () => {
    it('delegates to prisma.inventoryTransaction.create', async () => {
      const data = {
        inventoryId: INVENTORY_ID,
        type: InventoryTransactionType.ADJUSTMENT,
        quantity: -5,
        quantityBefore: 250,
        quantityAfter: 245,
        reason: 'damaged_in_transit',
      };
      mockPrismaService.inventoryTransaction.create.mockResolvedValue(mockTransaction);

      const result = await repository.createTransaction(data);

      expect(mockPrismaService.inventoryTransaction.create).toHaveBeenCalledWith({ data });
      expect(result).toBe(mockTransaction);
    });
  });

  describe('findTransactionsPaginated', () => {
    it('executes findMany and count in transaction', async () => {
      mockPrismaService.inventoryTransaction.findMany.mockResolvedValue([mockTransaction]);
      mockPrismaService.inventoryTransaction.count.mockResolvedValue(1);

      const where = { inventoryId: INVENTORY_ID };
      const [data, total] = await repository.findTransactionsPaginated(where, 1, 20);

      expect(data).toEqual([mockTransaction]);
      expect(total).toBe(1);
      expect(mockPrismaService.inventoryTransaction.findMany).toHaveBeenCalledWith({
        where,
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrismaService.inventoryTransaction.count).toHaveBeenCalledWith({ where });
    });
  });
});
