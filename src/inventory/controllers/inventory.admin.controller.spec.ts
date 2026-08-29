import { Test, TestingModule } from '@nestjs/testing';
import type { FastifyRequest } from 'fastify';
import { InventoryAdminController } from './inventory.admin.controller';
import { InventoryService } from '../inventory.service';
import { UpdateInventoryDto } from '../dto/update-inventory.dto';
import { AdjustInventoryDto } from '../dto/adjust-inventory.dto';
import { InventoryResponseDto } from '../dto/inventory-response.dto';
import { GetInventoryTransactionsQueryDto } from '../dto/get-inventory-transactions-query.dto';
import { InventoryTransactionResponseDto } from '../dto/inventory-transaction-response.dto';
import { InventoryTransactionType, UserRole } from '@prisma/client';
import { PaginatedResult } from '@/common/types/api-response.types';

const VARIANT_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '99999999-9999-9999-9999-999999999999';

const mockInventoryResponse: InventoryResponseDto = {
  id: '33333333-3333-3333-3333-333333333333',
  variantId: VARIANT_ID,
  quantity: 248,
  reservedQuantity: 12,
  availableQuantity: 236,
  updatedAt: new Date('2026-06-01T09:00:00.000Z'),
};

const mockTransactionResponse: InventoryTransactionResponseDto = {
  id: '44444444-4444-4444-4444-444444444444',
  inventoryId: '33333333-3333-3333-3333-333333333333',
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

const mockInventoryService = {
  getByVariantId: jest.fn(),
  updateQuantity: jest.fn(),
  adjustQuantity: jest.fn(),
  getTransactions: jest.fn(),
};

const mockRequest = {
  user: {
    sub: USER_ID,
    email: 'admin@timmbr.com',
    role: UserRole.ADMIN,
  },
} as unknown as FastifyRequest;

describe('InventoryAdminController', () => {
  let controller: InventoryAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryAdminController],
      providers: [{ provide: InventoryService, useValue: mockInventoryService }],
    }).compile();

    controller = module.get<InventoryAdminController>(InventoryAdminController);
  });

  afterEach(() => jest.resetAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getByVariantId', () => {
    it('delegates to service.getByVariantId', async () => {
      mockInventoryService.getByVariantId.mockResolvedValue(mockInventoryResponse);

      const result = await controller.getByVariantId(VARIANT_ID);

      expect(mockInventoryService.getByVariantId).toHaveBeenCalledWith(VARIANT_ID);
      expect(result).toBe(mockInventoryResponse);
    });
  });

  describe('getTransactions', () => {
    it('delegates to service.getTransactions', async () => {
      const query: GetInventoryTransactionsQueryDto = { page: 1, limit: 20 };
      const paginatedResult: PaginatedResult<InventoryTransactionResponseDto> = {
        data: [mockTransactionResponse],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
      mockInventoryService.getTransactions.mockResolvedValue(paginatedResult);

      const result = await controller.getTransactions(VARIANT_ID, query);

      expect(mockInventoryService.getTransactions).toHaveBeenCalledWith(VARIANT_ID, query);
      expect(result).toBe(paginatedResult);
    });
  });

  describe('update', () => {
    it('delegates to service.updateQuantity with user sub', async () => {
      const dto: UpdateInventoryDto = {
        quantity: 250,
        reason: 'Physical recount',
      };
      mockInventoryService.updateQuantity.mockResolvedValue(mockInventoryResponse);

      const result = await controller.update(VARIANT_ID, dto, mockRequest);

      expect(mockInventoryService.updateQuantity).toHaveBeenCalledWith(VARIANT_ID, dto, USER_ID);
      expect(result).toBe(mockInventoryResponse);
    });
  });

  describe('adjust', () => {
    it('delegates to service.adjustQuantity with user sub', async () => {
      const dto: AdjustInventoryDto = {
        delta: -5,
        reason: 'damaged_in_transit',
      };
      mockInventoryService.adjustQuantity.mockResolvedValue(mockInventoryResponse);

      const result = await controller.adjust(VARIANT_ID, dto, mockRequest);

      expect(mockInventoryService.adjustQuantity).toHaveBeenCalledWith(VARIANT_ID, dto, USER_ID);
      expect(result).toBe(mockInventoryResponse);
    });
  });
});
