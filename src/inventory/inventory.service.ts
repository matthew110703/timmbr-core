import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { InventoryTransactionType, Prisma } from '@prisma/client';
import { InventoryRepository } from './inventory.repository';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { InventoryResponseDto } from './dto/inventory-response.dto';
import { GetInventoryTransactionsQueryDto } from './dto/get-inventory-transactions-query.dto';
import { InventoryTransactionResponseDto } from './dto/inventory-transaction-response.dto';
import { InventoryMapper } from './inventory.mapper';
import {
  InsufficientStockException,
  InvalidInventoryQuantityException,
  InventoryNotFoundException,
} from '@/common/exceptions/inventory.exception';
import { PaginatedResult } from '@/common/types/api-response.types';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryRepository: InventoryRepository,
  ) {}

  async getByVariantId(variantId: string): Promise<InventoryResponseDto> {
    const inventory = await this.inventoryRepository.findByVariantId(variantId);
    if (!inventory) {
      throw new InventoryNotFoundException();
    }
    return InventoryMapper.toResponse(inventory);
  }

  async getTransactions(
    variantId: string,
    query: GetInventoryTransactionsQueryDto,
  ): Promise<PaginatedResult<InventoryTransactionResponseDto>> {
    const inventory = await this.inventoryRepository.findByVariantId(variantId);
    if (!inventory) {
      throw new InventoryNotFoundException();
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.InventoryTransactionWhereInput = {
      inventoryId: inventory.id,
      ...(query.type && { type: query.type }),
    };

    const [transactions, total] = await this.inventoryRepository.findTransactionsPaginated(
      where,
      page,
      limit,
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: transactions.map((t) => InventoryMapper.toTransactionResponse(t)),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async updateQuantity(
    variantId: string,
    dto: UpdateInventoryDto,
    userId?: string,
  ): Promise<InventoryResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await this.inventoryRepository.findWithLock(variantId, tx);
      if (!inventory) {
        throw new InventoryNotFoundException();
      }

      if (dto.quantity < inventory.reservedQuantity) {
        throw new InvalidInventoryQuantityException(
          `Quantity cannot be less than reserved quantity (${inventory.reservedQuantity}).`,
        );
      }

      const delta = dto.quantity - inventory.quantity;

      const updated = await this.inventoryRepository.update(
        inventory.id,
        { quantity: dto.quantity },
        tx,
      );

      await this.inventoryRepository.createTransaction(
        {
          inventoryId: inventory.id,
          type: InventoryTransactionType.ADJUSTMENT,
          quantity: delta,
          quantityBefore: inventory.quantity,
          quantityAfter: dto.quantity,
          reason: dto.reason ?? null,
          referenceType: dto.referenceType ?? null,
          referenceId: dto.referenceId ?? null,
          createdBy: userId ?? null,
        },
        tx,
      );

      return InventoryMapper.toResponse(updated);
    });
  }

  async adjustQuantity(
    variantId: string,
    dto: AdjustInventoryDto,
    userId?: string,
  ): Promise<InventoryResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await this.inventoryRepository.findWithLock(variantId, tx);
      if (!inventory) {
        throw new InventoryNotFoundException();
      }

      const newQuantity = inventory.quantity + dto.delta;

      if (newQuantity < 0) {
        throw new InsufficientStockException('Stock quantity cannot drop below 0.');
      }

      if (newQuantity < inventory.reservedQuantity) {
        throw new InsufficientStockException(
          `Adjustment would cause stock (${newQuantity}) to fall below reserved quantity (${inventory.reservedQuantity}).`,
        );
      }

      const type = dto.type ?? InventoryTransactionType.ADJUSTMENT;

      const updated = await this.inventoryRepository.update(
        inventory.id,
        { quantity: newQuantity },
        tx,
      );

      await this.inventoryRepository.createTransaction(
        {
          inventoryId: inventory.id,
          type,
          quantity: dto.delta,
          quantityBefore: inventory.quantity,
          quantityAfter: newQuantity,
          reason: dto.reason ?? null,
          referenceType: dto.referenceType ?? null,
          referenceId: dto.referenceId ?? null,
          createdBy: userId ?? null,
        },
        tx,
      );

      return InventoryMapper.toResponse(updated);
    });
  }
}
