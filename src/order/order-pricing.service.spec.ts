import { Test, TestingModule } from '@nestjs/testing';
import { OrderPricingService } from './order-pricing.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AddressNotFoundException } from '@/common/exceptions/address.exception';
import {
  OrderInsufficientStockException,
  OrderVariantUnavailableException,
} from '@/common/exceptions/order.exception';
import { ProductStatus, VariantStatus } from '@prisma/client';

describe('OrderPricingService', () => {
  let service: OrderPricingService;
  let prisma: jest.Mocked<PrismaService>;

  const mockAddress = {
    id: 'addr-uuid-1',
    userId: 'user-uuid-1',
    firstName: 'Arjun',
    lastName: 'Mehta',
    phone: '9876543210',
    line1: '100 Feet Rd',
    line2: null,
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560038',
    country: 'India',
    type: 'SHIPPING',
    label: 'Home',
  };

  const mockVariant = {
    id: 'variant-uuid-1',
    productId: 'product-uuid-1',
    sku: 'SOFA-BLK-3S',
    price: 1180,
    status: VariantStatus.ACTIVE,
    product: {
      id: 'product-uuid-1',
      title: 'Velvet Sofa',
      status: ProductStatus.ACTIVE,
      gstRate: 18,
      hsnCode: '9401',
    },
    inventory: {
      quantity: 10,
      reservedQuantity: 2,
    },
  };

  beforeEach(async () => {
    const mockPrisma = {
      address: {
        findUnique: jest.fn(),
      },
      productVariant: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OrderPricingService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<OrderPricingService>(OrderPricingService);
    prisma = module.get(PrismaService);
  });

  it('calculates quote correctly for valid address and stock', async () => {
    (prisma.address.findUnique as jest.Mock).mockResolvedValue(mockAddress);
    (prisma.productVariant.findMany as jest.Mock).mockResolvedValue([mockVariant]);

    const result = await service.calculateQuoteAndValidate(
      'user-uuid-1',
      [{ variantId: 'variant-uuid-1', quantity: 2 }],
      'addr-uuid-1',
    );

    expect(result.addressSnapshot.city).toBe('Bengaluru');
    expect(result.pricing.subtotal).toBe(2360);
    expect(result.pricing.tax).toBe(360);
    expect(result.pricing.grandTotal).toBe(2360);
    expect(result.pricing.currency).toBe('INR');
  });

  it('throws AddressNotFoundException if address does not exist or belongs to another user', async () => {
    (prisma.address.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.calculateQuoteAndValidate(
        'user-uuid-1',
        [{ variantId: 'variant-uuid-1', quantity: 2 }],
        'addr-uuid-1',
      ),
    ).rejects.toThrow(AddressNotFoundException);
  });

  it('throws OrderVariantUnavailableException if variant is inactive or missing', async () => {
    (prisma.address.findUnique as jest.Mock).mockResolvedValue(mockAddress);
    (prisma.productVariant.findMany as jest.Mock).mockResolvedValue([]);

    await expect(
      service.calculateQuoteAndValidate(
        'user-uuid-1',
        [{ variantId: 'variant-uuid-1', quantity: 2 }],
        'addr-uuid-1',
      ),
    ).rejects.toThrow(OrderVariantUnavailableException);
  });

  it('throws OrderInsufficientStockException when requested quantity exceeds available stock', async () => {
    (prisma.address.findUnique as jest.Mock).mockResolvedValue(mockAddress);
    (prisma.productVariant.findMany as jest.Mock).mockResolvedValue([
      {
        ...mockVariant,
        inventory: { quantity: 5, reservedQuantity: 4 }, // 1 available
      },
    ]);

    await expect(
      service.calculateQuoteAndValidate(
        'user-uuid-1',
        [{ variantId: 'variant-uuid-1', quantity: 2 }],
        'addr-uuid-1',
      ),
    ).rejects.toThrow(OrderInsufficientStockException);
  });
});
