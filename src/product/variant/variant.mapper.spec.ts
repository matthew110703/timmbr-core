import { ProductVariant, VariantStatus } from '@prisma/client';
import { VariantMapper } from './variant.mapper';

describe('VariantMapper', () => {
  const baseVariant: ProductVariant = {
    id: '22222222-2222-2222-2222-222222222222',
    productId: '11111111-1111-1111-1111-111111111111',
    sku: 'OAK-001',
    price: 25000,
    compareAtPrice: 30000,
    currency: 'INR',
    status: VariantStatus.ACTIVE,
    isDefault: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  it('maps ACTIVE variant with available stock > 0 to IN_STOCK with quantity', () => {
    const variantWithStock = {
      ...baseVariant,
      inventory: {
        id: '33333333-3333-3333-3333-333333333333',
        variantId: baseVariant.id,
        quantity: 50,
        reservedQuantity: 5,
        updatedAt: new Date('2026-01-01'),
      },
    };

    const response = VariantMapper.toResponse(variantWithStock);

    expect(response.availability).toEqual({
      status: 'IN_STOCK',
      quantity: 45, // 50 - 5
    });
  });

  it('maps ACTIVE variant with available stock = 0 to OUT_OF_STOCK with quantity 0', () => {
    const variantOutStock = {
      ...baseVariant,
      inventory: {
        id: '33333333-3333-3333-3333-333333333333',
        variantId: baseVariant.id,
        quantity: 5,
        reservedQuantity: 5,
        updatedAt: new Date('2026-01-01'),
      },
    };

    const response = VariantMapper.toResponse(variantOutStock);

    expect(response.availability).toEqual({
      status: 'OUT_OF_STOCK',
      quantity: 0,
    });
  });

  it('maps ACTIVE variant with no inventory record to OUT_OF_STOCK with quantity 0', () => {
    const response = VariantMapper.toResponse(baseVariant);

    expect(response.availability).toEqual({
      status: 'OUT_OF_STOCK',
      quantity: 0,
    });
  });

  it('maps DISCONTINUED variant to DISCONTINUED with quantity 0 even if physical stock exists', () => {
    const discontinuedVariant = {
      ...baseVariant,
      status: VariantStatus.DISCONTINUED,
      inventory: {
        id: '33333333-3333-3333-3333-333333333333',
        variantId: baseVariant.id,
        quantity: 50,
        reservedQuantity: 0,
        updatedAt: new Date('2026-01-01'),
      },
    };

    const response = VariantMapper.toResponse(discontinuedVariant);

    expect(response.availability).toEqual({
      status: 'DISCONTINUED',
      quantity: 0,
    });
  });

  it('maps HIDDEN variant to HIDDEN with quantity 0', () => {
    const hiddenVariant = {
      ...baseVariant,
      status: VariantStatus.HIDDEN,
      inventory: {
        id: '33333333-3333-3333-3333-333333333333',
        variantId: baseVariant.id,
        quantity: 50,
        reservedQuantity: 0,
        updatedAt: new Date('2026-01-01'),
      },
    };

    const response = VariantMapper.toResponse(hiddenVariant);

    expect(response.availability).toEqual({
      status: 'HIDDEN',
      quantity: 0,
    });
  });
});
