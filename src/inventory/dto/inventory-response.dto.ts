export class InventoryResponseDto {
  id!: string;
  variantId!: string;
  quantity!: number;
  reservedQuantity!: number;
  availableQuantity!: number;
  updatedAt!: Date;
}
