import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Inventory, InventoryTransaction, Prisma } from '@prisma/client';

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByVariantId(
    variantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Inventory | null> {
    const client = tx ?? this.prisma;
    return client.inventory.findUnique({
      where: { variantId },
    });
  }

  async findWithLock(variantId: string, tx: Prisma.TransactionClient): Promise<Inventory | null> {
    const records = await tx.$queryRaw<Inventory[]>`
      SELECT id, "variantId", quantity, "reservedQuantity", "updatedAt"
      FROM "Inventory"
      WHERE "variantId" = ${variantId}
      FOR UPDATE
    `;
    return records[0] ?? null;
  }

  async create(
    data: Prisma.InventoryCreateInput | Prisma.InventoryUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Inventory> {
    const client = tx ?? this.prisma;
    return client.inventory.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.InventoryUpdateInput | Prisma.InventoryUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Inventory> {
    const client = tx ?? this.prisma;
    return client.inventory.update({
      where: { id },
      data,
    });
  }

  async createTransaction(
    data: Prisma.InventoryTransactionCreateInput | Prisma.InventoryTransactionUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryTransaction> {
    const client = tx ?? this.prisma;
    return client.inventoryTransaction.create({
      data,
    });
  }

  async findTransactionsPaginated(
    where: Prisma.InventoryTransactionWhereInput,
    page: number,
    limit: number,
  ): Promise<[InventoryTransaction[], number]> {
    return this.prisma.$transaction([
      this.prisma.inventoryTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryTransaction.count({ where }),
    ]);
  }
}
