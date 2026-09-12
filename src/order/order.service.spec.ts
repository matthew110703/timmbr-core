import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderRepository } from './order.repository';
import { OrderPricingService } from './order-pricing.service';
import { RazorpayService } from '@/payment/razorpay.service';
import { PaymentRepository } from '@/payment/payment.repository';
import {
  OrderAccessForbiddenException,
  OrderIllegalStateTransitionException,
  OrderNotFoundException,
} from '@/common/exceptions/order.exception';
import { OrderStatus, PaymentProvider, PaymentStatus } from '@prisma/client';

describe('OrderService', () => {
  let service: OrderService;
  let orderRepository: jest.Mocked<OrderRepository>;
  let orderPricingService: jest.Mocked<OrderPricingService>;
  let razorpayService: jest.Mocked<RazorpayService>;
  let mockTx: any;

  const mockOrder: any = {
    id: 'order-uuid-1',
    userId: 'user-uuid-1',
    cartId: null,
    status: OrderStatus.PENDING,
    subtotal: 2000,
    discount: 0,
    shippingFee: 0,
    tax: 360,
    grandTotal: 2000,
    currency: 'INR',
    shippingAddressId: 'addr-uuid-1',
    shippingAddress: { city: 'Bengaluru' },
    placedAt: null,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: 'item-uuid-1',
        orderId: 'order-uuid-1',
        productId: 'prod-uuid-1',
        variantId: 'var-uuid-1',
        name: 'Sofa',
        sku: 'SOFA-1',
        quantity: 1,
        unitPrice: 2000,
        totalPrice: 2000,
        hsnCode: '9401',
        gstRate: 18,
        taxAmount: 360,
        metadata: null,
        createdAt: new Date(),
      },
    ],
    payments: [],
  };

  beforeEach(async () => {
    mockTx = {
      inventory: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-1',
          variantId: 'var-uuid-1',
          quantity: 10,
          reservedQuantity: 2,
        }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      },
      order: {
        create: jest.fn().mockResolvedValue(mockOrder),
        update: jest.fn().mockResolvedValue({ ...mockOrder, status: OrderStatus.CONFIRMED }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const mockPrisma = {
      $transaction: jest.fn((cb) => cb(mockTx)),
    };

    const mockOrderRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findUserOrders: jest.fn(),
      findAdminOrders: jest.fn(),
      update: jest.fn(),
      findExpiredPendingOrders: jest.fn(),
    };

    const mockPricingService = {
      calculateQuoteAndValidate: jest.fn().mockResolvedValue({
        addressSnapshot: { city: 'Bengaluru' },
        calculatedItems: [
          {
            variantId: 'var-uuid-1',
            productId: 'prod-uuid-1',
            name: 'Sofa',
            sku: 'SOFA-1',
            quantity: 1,
            unitPrice: 2000,
            totalPrice: 2000,
            hsnCode: '9401',
            gstRate: 18,
            taxAmount: 360,
            variant: {},
          },
        ],
        pricing: {
          items: [],
          subtotal: 2000,
          discount: 0,
          shippingFee: 0,
          tax: 360,
          grandTotal: 2000,
          currency: 'INR',
        },
      }),
    };

    const mockRazorpay = {
      createOrder: jest.fn().mockResolvedValue({
        id: 'order_rzp_123',
        amount: 200000,
        currency: 'INR',
        status: 'created',
      }),
      getKeyId: jest.fn().mockReturnValue('rzp_test_key'),
    };

    const mockPaymentRepo = {
      create: jest.fn().mockResolvedValue({
        id: 'pay-uuid-1',
        orderId: 'order-uuid-1',
        provider: PaymentProvider.RAZORPAY,
        providerOrderId: 'order_rzp_123',
        amount: 2000,
        currency: 'INR',
        status: PaymentStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findByOrderId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OrderRepository, useValue: mockOrderRepo },
        { provide: OrderPricingService, useValue: mockPricingService },
        { provide: RazorpayService, useValue: mockRazorpay },
        { provide: PaymentRepository, useValue: mockPaymentRepo },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orderRepository = module.get(OrderRepository);
    orderPricingService = module.get(OrderPricingService);
    razorpayService = module.get(RazorpayService);
  });

  describe('createOrder', () => {
    it('creates an order, reserves stock, creates razorpay order, and returns payment payload', async () => {
      const result = await service.createOrder('user-uuid-1', {
        shippingAddressId: 'addr-uuid-1',
        items: [{ variantId: 'var-uuid-1', quantity: 1 }],
      });

      expect(orderPricingService.calculateQuoteAndValidate).toHaveBeenCalled();
      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: expect.any(Date),
          }),
        }),
      );
      expect(razorpayService.createOrder).toHaveBeenCalledWith({
        amount: 200000,
        currency: 'INR',
        receipt: 'order-uuid-1',
        notes: { orderId: 'order-uuid-1', userId: 'user-uuid-1' },
      });
      expect(result.order.id).toBe('order-uuid-1');
      expect(result.payment.razorpayOrderId).toBe('order_rzp_123');
      expect(result.payment.razorpayKeyId).toBe('rzp_test_key');
    });
  });

  describe('cleanupExpiredOrders', () => {
    it('returns success with 0 processed when no orders are expired', async () => {
      orderRepository.findExpiredPendingOrders.mockResolvedValue([]);

      const result = await service.cleanupExpiredOrders(500);

      expect(orderRepository.findExpiredPendingOrders).toHaveBeenCalledWith(500);
      expect(result).toEqual({
        success: true,
        processedCount: 0,
        hasMore: false,
      });
      expect(mockTx.order.updateMany).not.toHaveBeenCalled();
    });

    it('cleans up expired orders, aggregates variants, restores inventory, and cancels orders and payments', async () => {
      const expiredOrdersMock: any[] = [
        {
          id: 'order-1',
          items: [
            { variantId: 'variant-A', quantity: 2 },
            { variantId: 'variant-B', quantity: 1 },
          ],
        },
        {
          id: 'order-2',
          items: [{ variantId: 'variant-A', quantity: 3 }],
        },
      ];

      orderRepository.findExpiredPendingOrders.mockResolvedValue(expiredOrdersMock);

      const result = await service.cleanupExpiredOrders(2);

      expect(orderRepository.findExpiredPendingOrders).toHaveBeenCalledWith(2);

      // Verify variant aggregation: variant-A total = 5, variant-B total = 1
      // With floor check: Math.max(0, reservedQuantity(2) - 5) = 0
      expect(mockTx.inventory.findUnique).toHaveBeenCalledWith({
        where: { variantId: 'variant-A' },
      });
      expect(mockTx.inventory.update).toHaveBeenCalledWith({
        where: { variantId: 'variant-A' },
        data: {
          reservedQuantity: 0,
        },
      });
      // Math.max(0, reservedQuantity(2) - 1) = 1
      expect(mockTx.inventory.findUnique).toHaveBeenCalledWith({
        where: { variantId: 'variant-B' },
      });
      expect(mockTx.inventory.update).toHaveBeenCalledWith({
        where: { variantId: 'variant-B' },
        data: {
          reservedQuantity: 1,
        },
      });

      // Verify atomic cancellation of orders
      expect(mockTx.order.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['order-1', 'order-2'] },
          status: OrderStatus.PENDING,
        },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });

      // Verify atomic cancellation of payments
      expect(mockTx.payment.updateMany).toHaveBeenCalledWith({
        where: {
          orderId: { in: ['order-1', 'order-2'] },
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.CANCELLED,
        },
      });

      expect(result).toEqual({
        success: true,
        processedCount: 2,
        hasMore: true, // batch size was 2 and exactly 2 were returned
      });
    });
  });

  describe('getUserOrderById', () => {
    it('returns user order when found', async () => {
      orderRepository.findById.mockResolvedValue(mockOrder);
      const result = await service.getUserOrderById('user-uuid-1', 'order-uuid-1');
      expect(result.id).toBe('order-uuid-1');
    });

    it('throws OrderAccessForbiddenException if order belongs to another user', async () => {
      orderRepository.findById.mockResolvedValue(mockOrder);
      await expect(service.getUserOrderById('another-user', 'order-uuid-1')).rejects.toThrow(
        OrderAccessForbiddenException,
      );
    });

    it('throws OrderNotFoundException when order does not exist', async () => {
      orderRepository.findById.mockResolvedValue(null);
      await expect(service.getUserOrderById('user-uuid-1', 'non-existent')).rejects.toThrow(
        OrderNotFoundException,
      );
    });
  });

  describe('updateOrderStatus', () => {
    it('allows valid state transition (e.g. PENDING -> CONFIRMED)', async () => {
      orderRepository.findById.mockResolvedValue(mockOrder);
      const result = await service.updateOrderStatus('order-uuid-1', OrderStatus.CONFIRMED);
      expect(result.status).toBe(OrderStatus.CONFIRMED);
    });

    it('throws OrderIllegalStateTransitionException on illegal jump (e.g. DELIVERED -> PENDING)', async () => {
      orderRepository.findById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.DELIVERED,
      });

      await expect(service.updateOrderStatus('order-uuid-1', OrderStatus.PENDING)).rejects.toThrow(
        OrderIllegalStateTransitionException,
      );
    });
  });

  describe('getAdminOrders', () => {
    it('returns paginated minimized order list items', async () => {
      const mockRawAdminOrder = {
        id: 'order-uuid-1',
        userId: 'user-uuid-1',
        status: OrderStatus.CONFIRMED,
        grandTotal: 1000,
        currency: 'INR',
        placedAt: new Date(),
        createdAt: new Date(),
        user: {
          id: 'user-uuid-1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+919999999999',
        },
        payments: [{ status: PaymentStatus.PAID }],
        _count: { items: 3 },
      };

      orderRepository.findAdminOrders.mockResolvedValue([[mockRawAdminOrder], 1]);

      const result = await service.getAdminOrders({ page: 1, limit: 20 });

      expect(orderRepository.findAdminOrders).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: 'order-uuid-1',
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        grandTotal: 1000,
        currency: 'INR',
        itemsCount: 3,
        customer: {
          id: 'user-uuid-1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+919999999999',
        },
        placedAt: expect.any(Date),
        expiresAt: null,
        createdAt: expect.any(Date),
      });
      expect(result.meta.total).toBe(1);
    });
  });
});
