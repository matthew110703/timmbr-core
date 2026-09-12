import { Inventory, ProductVariant, VariantStatus } from '@prisma/client';
import { VariantAvailabilityStatus, VariantResponseDto } from './dto/variant-response.dto';

export type ProductVariantWithInventory = ProductVariant & {
  inventory?: Inventory | null;
};

export class VariantMapper {
  static toResponse(variant: ProductVariantWithInventory): VariantResponseDto {
    const availableQty = Math.max(
      0,
      (variant.inventory?.quantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0),
    );

    let availabilityStatus: VariantAvailabilityStatus;
    let availabilityQuantity = 0;

    if (variant.status === VariantStatus.DISCONTINUED) {
      availabilityStatus = 'DISCONTINUED';
      availabilityQuantity = 0;
    } else if (variant.status === VariantStatus.HIDDEN) {
      availabilityStatus = 'HIDDEN';
      availabilityQuantity = 0;
    } else if (availableQty > 0) {
      availabilityStatus = 'IN_STOCK';
      availabilityQuantity = availableQty;
    } else {
      availabilityStatus = 'OUT_OF_STOCK';
      availabilityQuantity = 0;
    }

    return {
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      price: Number(variant.price),
      isDefault: variant.isDefault,
      status: variant.status,
      currency: variant.currency,
      compareAtPrice:
        variant.compareAtPrice !== null && variant.compareAtPrice !== undefined
          ? Number(variant.compareAtPrice)
          : null,
      availability: {
        status: availabilityStatus,
        quantity: availabilityQuantity,
      },
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };
  }
}
