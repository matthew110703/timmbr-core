import { InventoryTransactionType } from '@prisma/client';

export class InventoryTransactionResponseDto {
  id!: string;
  inventoryId!: string;
  type!: InventoryTransactionType;
  quantity!: number;
  quantityBefore!: number;
  quantityAfter!: number;
  reason!: string | null;
  referenceType!: string | null;
  referenceId!: string | null;
  createdBy!: string | null;
  createdAt!: Date;
}
