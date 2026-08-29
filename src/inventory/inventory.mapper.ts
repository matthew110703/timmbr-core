import { Inventory, InventoryTransaction } from '@prisma/client';
import { InventoryResponseDto } from './dto/inventory-response.dto';
import { InventoryTransactionResponseDto } from './dto/inventory-transaction-response.dto';

export class InventoryMapper {
  static toResponse(inventory: Inventory): InventoryResponseDto {
    return {
      id: inventory.id,
      variantId: inventory.variantId,
      quantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
      availableQuantity: inventory.quantity - inventory.reservedQuantity,
      updatedAt: inventory.updatedAt,
    };
  }

  static toTransactionResponse(transaction: InventoryTransaction): InventoryTransactionResponseDto {
    return {
      id: transaction.id,
      inventoryId: transaction.inventoryId,
      type: transaction.type,
      quantity: transaction.quantity,
      quantityBefore: transaction.quantityBefore,
      quantityAfter: transaction.quantityAfter,
      reason: transaction.reason,
      referenceType: transaction.referenceType,
      referenceId: transaction.referenceId,
      createdBy: transaction.createdBy,
      createdAt: transaction.createdAt,
    };
  }
}
