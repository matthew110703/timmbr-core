import { Test, TestingModule } from '@nestjs/testing';
import { OrderPricingService } from './order-pricing.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  AddressInvalidTypeException,
  AddressNotFoundException,
} from '@/common/exceptions/address.exception';
import {
  OrderInsufficientStockException,
  OrderVariantUnavailableException,
} from '@/common/exceptions/order.exception';
import { InvoiceInvalidShippingStateException } from '@/common/exceptions/invoice.exception';
import { AddressType, ProductStatus, VariantStatus } from '@prisma/client';

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
    type: AddressType.SHIPPING,
    label: 'Home',
    isDefault: true,
    latitude: null,
    longitude: null,
  };

  const mockBillingAddress = {
    id: 'addr-billing-1',
    userId: 'user-uuid-1',
    firstName: 'Arjun',
    lastName: 'Mehta',
    phone: '9876543210',
    line1: '45 Corporate Park',
    line2: null,
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    country: 'India',
    type: AddressType.BILLING,
    label: 'Office',
    isDefault: true,
    latitude: null,
    longitude: null,
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
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
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
    expect(result.addressSnapshot.type).toBe(AddressType.SHIPPING);
    expect(result.billingAddressSnapshot.type).toBe(AddressType.BILLING);
    expect(result.pricing.subtotal).toBe(2360);
    expect(result.pricing.tax).toBe(360);
    expect(result.pricing.grandTotal).toBe(2360);
    expect(result.pricing.currency).toBe('INR');
  });

  it('uses existing default BILLING address when billingAddressId is omitted', async () => {
    (prisma.address.findUnique as jest.Mock).mockResolvedValue(mockAddress);
    (prisma.address.findFirst as jest.Mock).mockResolvedValue(mockBillingAddress);
    (prisma.productVariant.findMany as jest.Mock).mockResolvedValue([mockVariant]);

    const result = await service.calculateQuoteAndValidate(
      'user-uuid-1',
      [{ variantId: 'variant-uuid-1', quantity: 1 }],
      'addr-uuid-1',
      undefined,
      { ensureBillingAddress: true },
    );

    expect(prisma.address.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-uuid-1',
        type: AddressType.BILLING,
        isDefault: true,
      },
    });
    expect(prisma.address.create).not.toHaveBeenCalled();
    expect(result.billingAddressSnapshot.id).toBe('addr-billing-1');
    expect(result.billingAddressSnapshot.city).toBe('Mumbai');
    expect(result.billingAddressSnapshot.type).toBe(AddressType.BILLING);
  });

  it('creates a new default BILLING address from shipping address when billingAddressId is omitted and no default BILLING address exists', async () => {
    (prisma.address.findUnique as jest.Mock).mockResolvedValue(mockAddress);
    (prisma.address.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.address.create as jest.Mock).mockResolvedValue({
      ...mockAddress,
      id: 'addr-billing-created',
      type: AddressType.BILLING,
      isDefault: true,
    });
    (prisma.productVariant.findMany as jest.Mock).mockResolvedValue([mockVariant]);

    const result = await service.calculateQuoteAndValidate(
      'user-uuid-1',
      [{ variantId: 'variant-uuid-1', quantity: 1 }],
      'addr-uuid-1',
      undefined,
      { ensureBillingAddress: true },
    );

    expect(prisma.address.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-uuid-1',
        type: AddressType.BILLING,
        isDefault: true,
        city: 'Bengaluru',
      }),
    });
    expect(result.billingAddressSnapshot.id).toBe('addr-billing-created');
    expect(result.billingAddressSnapshot.type).toBe(AddressType.BILLING);
  });

  it('rejects a BILLING address passed as shippingAddressId', async () => {
    (prisma.address.findUnique as jest.Mock).mockResolvedValue(mockBillingAddress);

    await expect(
      service.calculateQuoteAndValidate(
        'user-uuid-1',
        [{ variantId: 'variant-uuid-1', quantity: 1 }],
        'addr-billing-1',
      ),
    ).rejects.toThrow(AddressInvalidTypeException);
  });

  it('rejects a SHIPPING address passed as billingAddressId', async () => {
    (prisma.address.findUnique as jest.Mock)
      .mockResolvedValueOnce(mockAddress)
      .mockResolvedValueOnce({ ...mockAddress, id: 'addr-shipping-2' });

    await expect(
      service.calculateQuoteAndValidate(
        'user-uuid-1',
        [{ variantId: 'variant-uuid-1', quantity: 1 }],
        'addr-uuid-1',
        'addr-shipping-2',
      ),
    ).rejects.toThrow(AddressInvalidTypeException);
  });

  it('rejects an address with an unrecognized Indian GST state', async () => {
    (prisma.address.findUnique as jest.Mock).mockResolvedValue({
      ...mockAddress,
      state: 'Atlantis',
    });

    await expect(
      service.calculateQuoteAndValidate(
        'user-uuid-1',
        [{ variantId: 'variant-uuid-1', quantity: 1 }],
        'addr-uuid-1',
      ),
    ).rejects.toThrow(InvoiceInvalidShippingStateException);
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
