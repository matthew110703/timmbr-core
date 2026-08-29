import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { InventoryTransactionType } from '@prisma/client';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { GetInventoryTransactionsQueryDto } from './dto/get-inventory-transactions-query.dto';
import {
  InsufficientStockException,
  InvalidInventoryQuantityException,
  InventoryNotFoundException,
} from '@/common/exceptions/inventory.exception';

const VARIANT_ID = '22222222-2222-2222-2222-222222222222';
const INVENTORY_ID = '33333333-3333-3333-3333-333333333333';
const TRANSACTION_ID = '44444444-4444-4444-4444-444444444444';
const USER_ID = '99999999-9999-9999-9999-999999999999';

const mockInventory = {
  id: INVENTORY_ID,
  variantId: VARIANT_ID,
  quantity: 248,
  reservedQuantity: 12,
  updatedAt: new Date('2026-06-01T09:00:00.000Z'),
};

const mockTransaction = {
  id: TRANSACTION_ID,
  inventoryId: INVENTORY_ID,
  type: InventoryTransactionType.ADJUSTMENT,
  quantity: -5,
  quantityBefore: 248,
  quantityAfter: 243,
  reason: 'damaged_in_transit',
  referenceType: 'ORDER',
  referenceId: 'order_123',
  createdBy: USER_ID,
  createdAt: new Date('2026-06-01T09:05:00.000Z'),
};

describe('InventoryService', () => {
  let service: InventoryService;

  const mockInventoryRepository = {
    findByVariantId: jest.fn(),
    findWithLock: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    createTransaction: jest.fn(),
    findTransactionsPaginated: jest.fn(),
  };

  const mockPrismaService = {
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    mockPrismaService.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrismaService) => unknown) => fn(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: InventoryRepository, useValue: mockInventoryRepository },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getByVariantId', () => {
    it('returns inventory with computed availableQuantity', async () => {
      mockInventoryRepository.findByVariantId.mockResolvedValue(mockInventory);

      const result = await service.getByVariantId(VARIANT_ID);

      expect(mockInventoryRepository.findByVariantId).toHaveBeenCalledWith(VARIANT_ID);
      expect(result).toEqual({
        id: INVENTORY_ID,
        variantId: VARIANT_ID,
        quantity: 248,
        reservedQuantity: 12,
        availableQuantity: 236,
        updatedAt: mockInventory.updatedAt,
      });
    });

    it('throws InventoryNotFoundException when inventory does not exist', async () => {
      mockInventoryRepository.findByVariantId.mockResolvedValue(null);

      const error = await service.getByVariantId(VARIANT_ID).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(InventoryNotFoundException);
    });
  });

  describe('getTransactions', () => {
    const query: GetInventoryTransactionsQueryDto = { page: 1, limit: 20 };

    it('returns paginated transactions for a variant', async () => {
      mockInventoryRepository.findByVariantId.mockResolvedValue(mockInventory);
      mockInventoryRepository.findTransactionsPaginated.mockResolvedValue([[mockTransaction], 1]);

      const result = await service.getTransactions(VARIANT_ID, query);

      expect(mockInventoryRepository.findByVariantId).toHaveBeenCalledWith(VARIANT_ID);
      expect(mockInventoryRepository.findTransactionsPaginated).toHaveBeenCalledWith(
        { inventoryId: INVENTORY_ID },
        1,
        20,
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(TRANSACTION_ID);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it('filters transactions by type when provided', async () => {
      mockInventoryRepository.findByVariantId.mockResolvedValue(mockInventory);
      mockInventoryRepository.findTransactionsPaginated.mockResolvedValue([[mockTransaction], 1]);

      await service.getTransactions(VARIANT_ID, {
        ...query,
        type: InventoryTransactionType.DAMAGE,
      });

      expect(mockInventoryRepository.findTransactionsPaginated).toHaveBeenCalledWith(
        {
          inventoryId: INVENTORY_ID,
          type: InventoryTransactionType.DAMAGE,
        },
        1,
        20,
      );
    });

    it('throws InventoryNotFoundException when inventory is not found', async () => {
      mockInventoryRepository.findByVariantId.mockResolvedValue(null);

      const error = await service.getTransactions(VARIANT_ID, query).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(InventoryNotFoundException);
    });
  });

  describe('updateQuantity', () => {
    const updateDto: UpdateInventoryDto = {
      quantity: 250,
      reason: 'Physical stock reconciliation',
      referenceType: 'AUDIT',
      referenceId: 'audit_001',
    };

    it('throws InventoryNotFoundException when inventory is not found', async () => {
      mockInventoryRepository.findWithLock.mockResolvedValue(null);

      const error = await service
        .updateQuantity(VARIANT_ID, updateDto, USER_ID)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(InventoryNotFoundException);
    });

    it('throws InvalidInventoryQuantityException when new quantity < reservedQuantity', async () => {
      mockInventoryRepository.findWithLock.mockResolvedValue(mockInventory);

      const invalidDto: UpdateInventoryDto = {
        quantity: 5, // reservedQuantity is 12
      };

      const error = await service
        .updateQuantity(VARIANT_ID, invalidDto, USER_ID)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(InvalidInventoryQuantityException);
      expect(mockInventoryRepository.update).not.toHaveBeenCalled();
      expect(mockInventoryRepository.createTransaction).not.toHaveBeenCalled();
    });

    it('updates quantity and writes ADJUSTMENT ledger transaction', async () => {
      mockInventoryRepository.findWithLock.mockResolvedValue(mockInventory);
      const updatedInventory = {
        ...mockInventory,
        quantity: 250,
        updatedAt: new Date('2026-06-01T09:10:00.000Z'),
      };
      mockInventoryRepository.update.mockResolvedValue(updatedInventory);

      const result = await service.updateQuantity(VARIANT_ID, updateDto, USER_ID);

      expect(mockInventoryRepository.findWithLock).toHaveBeenCalledWith(
        VARIANT_ID,
        mockPrismaService,
      );
      expect(mockInventoryRepository.update).toHaveBeenCalledWith(
        INVENTORY_ID,
        { quantity: 250 },
        mockPrismaService,
      );
      expect(mockInventoryRepository.createTransaction).toHaveBeenCalledWith(
        {
          inventoryId: INVENTORY_ID,
          type: InventoryTransactionType.ADJUSTMENT,
          quantity: 2, // 250 - 248
          quantityBefore: 248,
          quantityAfter: 250,
          reason: 'Physical stock reconciliation',
          referenceType: 'AUDIT',
          referenceId: 'audit_001',
          createdBy: USER_ID,
        },
        mockPrismaService,
      );
      expect(result).toEqual({
        id: INVENTORY_ID,
        variantId: VARIANT_ID,
        quantity: 250,
        reservedQuantity: 12,
        availableQuantity: 238,
        updatedAt: updatedInventory.updatedAt,
      });
    });
  });

  describe('adjustQuantity', () => {
    const adjustDto: AdjustInventoryDto = {
      delta: -5,
      reason: 'damaged_in_transit',
      type: InventoryTransactionType.DAMAGE,
      referenceType: 'ORDER',
      referenceId: 'order_123',
    };

    it('throws InventoryNotFoundException when inventory is not found', async () => {
      mockInventoryRepository.findWithLock.mockResolvedValue(null);

      const error = await service
        .adjustQuantity(VARIANT_ID, adjustDto, USER_ID)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(InventoryNotFoundException);
    });

    it('throws InsufficientStockException when new quantity would drop below 0', async () => {
      mockInventoryRepository.findWithLock.mockResolvedValue(mockInventory); // quantity: 248

      const excessiveDropDto: AdjustInventoryDto = {
        delta: -300,
      };

      const error = await service
        .adjustQuantity(VARIANT_ID, excessiveDropDto, USER_ID)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(InsufficientStockException);
      expect(mockInventoryRepository.update).not.toHaveBeenCalled();
      expect(mockInventoryRepository.createTransaction).not.toHaveBeenCalled();
    });

    it('throws InsufficientStockException when new quantity would drop below reservedQuantity', async () => {
      mockInventoryRepository.findWithLock.mockResolvedValue(mockInventory); // quantity: 248, reservedQuantity: 12

      const dropDto: AdjustInventoryDto = {
        delta: -240, // 248 - 240 = 8 < 12
      };

      const error = await service
        .adjustQuantity(VARIANT_ID, dropDto, USER_ID)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(InsufficientStockException);
      expect(mockInventoryRepository.update).not.toHaveBeenCalled();
      expect(mockInventoryRepository.createTransaction).not.toHaveBeenCalled();
    });

    it('adjusts quantity atomically and writes transaction ledger', async () => {
      mockInventoryRepository.findWithLock.mockResolvedValue(mockInventory); // 248
      const updatedInventory = {
        ...mockInventory,
        quantity: 243,
        updatedAt: new Date('2026-06-01T09:15:00.000Z'),
      };
      mockInventoryRepository.update.mockResolvedValue(updatedInventory);

      const result = await service.adjustQuantity(VARIANT_ID, adjustDto, USER_ID);

      expect(mockInventoryRepository.findWithLock).toHaveBeenCalledWith(
        VARIANT_ID,
        mockPrismaService,
      );
      expect(mockInventoryRepository.update).toHaveBeenCalledWith(
        INVENTORY_ID,
        { quantity: 243 },
        mockPrismaService,
      );
      expect(mockInventoryRepository.createTransaction).toHaveBeenCalledWith(
        {
          inventoryId: INVENTORY_ID,
          type: InventoryTransactionType.DAMAGE,
          quantity: -5,
          quantityBefore: 248,
          quantityAfter: 243,
          reason: 'damaged_in_transit',
          referenceType: 'ORDER',
          referenceId: 'order_123',
          createdBy: USER_ID,
        },
        mockPrismaService,
      );
      expect(result).toEqual({
        id: INVENTORY_ID,
        variantId: VARIANT_ID,
        quantity: 243,
        reservedQuantity: 12,
        availableQuantity: 231,
        updatedAt: updatedInventory.updatedAt,
      });
    });

    it('defaults type to ADJUSTMENT when type is not provided in adjust DTO', async () => {
      mockInventoryRepository.findWithLock.mockResolvedValue(mockInventory);
      const updatedInventory = {
        ...mockInventory,
        quantity: 258,
      };
      mockInventoryRepository.update.mockResolvedValue(updatedInventory);

      await service.adjustQuantity(VARIANT_ID, { delta: 10 }, USER_ID);

      expect(mockInventoryRepository.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: InventoryTransactionType.ADJUSTMENT,
          quantity: 10,
          quantityBefore: 248,
          quantityAfter: 258,
        }),
        mockPrismaService,
      );
    });
  });
});
