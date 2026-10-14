import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RazorpayService } from './razorpay.service';
import { PaymentRepository } from './payment.repository';
import { PaymentNotFoundException } from '@/common/exceptions/payment.exception';
import {
  OrderAccessForbiddenException,
  OrderNotPayableException,
} from '@/common/exceptions/order.exception';
import { OrderStatus, PaymentProvider, PaymentStatus } from '@prisma/client';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepository: jest.Mocked<PaymentRepository>;
  let razorpayService: jest.Mocked<RazorpayService>;

  const mockPayment: any = {
    id: 'pay-uuid-1',
    orderId: 'order-uuid-1',
    provider: PaymentProvider.RAZORPAY,
    providerOrderId: 'order_rzp_123',
    providerPaymentId: null,
    amount: 1999,
    currency: 'INR',
    status: PaymentStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const dto = {
    razorpayOrderId: 'order_rzp_123',
    razorpayPaymentId: 'pay_rzp_123',
    razorpaySignature: 'sig_123',
  };

  let mockPrisma: any;
  let tx: any;

  beforeEach(async () => {
    tx = {
      payment: {
        update: jest.fn().mockResolvedValue({
          ...mockPayment,
          status: PaymentStatus.PAID,
          providerPaymentId: 'pay_rzp_123',
        }),
      },
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ status: OrderStatus.CONFIRMED }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'order-uuid-1',
          cartId: 'cart-uuid-1',
          status: OrderStatus.CONFIRMED,
          items: [{ id: 'item-uuid-1', variantId: 'variant-uuid-1', quantity: 2 }],
        }),
      },
      inventory: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv-uuid-1',
          quantity: 10,
          reservedQuantity: 2,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryTransaction: { create: jest.fn().mockResolvedValue({}) },
      cart: { update: jest.fn().mockResolvedValue({}) },
    };

    mockPrisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-uuid-1',
          userId: 'user-uuid-1',
          status: OrderStatus.PENDING,
        }),
      },
      $transaction: jest.fn((cb) => cb(tx)),
    };

    const mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByOrderId: jest.fn(),
      findByProviderOrderId: jest.fn(),
      update: jest.fn(),
    };

    const mockRazorpay = {
      verifyPaymentSignature: jest.fn().mockReturnValue(true),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      createOrder: jest.fn(),
      getKeyId: jest.fn().mockReturnValue('rzp_test_123'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaymentRepository, useValue: mockRepo },
        { provide: RazorpayService, useValue: mockRazorpay },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    paymentRepository = module.get(PaymentRepository);
    razorpayService = module.get(RazorpayService);
  });

  describe('verifyPayment', () => {
    it('verifies signature and transitions payment to PAID and order to CONFIRMED', async () => {
      paymentRepository.findByProviderOrderId.mockResolvedValue(mockPayment);

      const result = await service.verifyPayment('user-uuid-1', dto);

      expect(razorpayService.verifyPaymentSignature).toHaveBeenCalled();
      expect(result.payment.status).toBe(PaymentStatus.PAID);
      expect(result.orderStatus).toBe(OrderStatus.CONFIRMED);
      expect(result.orderId).toBe('order-uuid-1');
      expect(tx.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'order-uuid-1', status: OrderStatus.PENDING } }),
      );
      expect(tx.inventoryTransaction.create).toHaveBeenCalledTimes(1);
      expect(tx.cart.update).toHaveBeenCalledTimes(1);
    });

    it('throws PaymentNotFoundException when provider order id is not found', async () => {
      paymentRepository.findByProviderOrderId.mockResolvedValue(null);

      await expect(
        service.verifyPayment('user-uuid-1', { ...dto, razorpayOrderId: 'unknown_order' }),
      ).rejects.toThrow(PaymentNotFoundException);
    });

    it('rejects a signed payment that belongs to another users order', async () => {
      paymentRepository.findByProviderOrderId.mockResolvedValue(mockPayment);

      await expect(service.verifyPayment('someone-else', dto)).rejects.toThrow(
        OrderAccessForbiddenException,
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('is idempotent once the payment is PAID', async () => {
      paymentRepository.findByProviderOrderId.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.PAID,
      });
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-uuid-1',
        userId: 'user-uuid-1',
        status: OrderStatus.CONFIRMED,
      });

      const result = await service.verifyPayment('user-uuid-1', dto);

      expect(result.orderStatus).toBe(OrderStatus.CONFIRMED);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('a replayed verify for a payment whose order was cancelled does not say success', async () => {
      paymentRepository.findByProviderOrderId.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.PAID,
      });
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-uuid-1',
        userId: 'user-uuid-1',
        status: OrderStatus.CANCELLED,
      });

      await expect(service.verifyPayment('user-uuid-1', dto)).rejects.toThrow(
        OrderNotPayableException,
      );
    });

    it('does not take the stock out twice when the webhook confirmed the order first', async () => {
      paymentRepository.findByProviderOrderId.mockResolvedValue(mockPayment);
      tx.order.updateMany.mockResolvedValue({ count: 0 });
      tx.order.findUnique.mockResolvedValue({ status: OrderStatus.CONFIRMED });

      const result = await service.verifyPayment('user-uuid-1', dto);

      expect(result.orderStatus).toBe(OrderStatus.CONFIRMED);
      expect(tx.inventory.update).not.toHaveBeenCalled();
      expect(tx.inventoryTransaction.create).not.toHaveBeenCalled();
    });

    it('records the payment but reports ORDER_NOT_PAYABLE when the order already expired', async () => {
      paymentRepository.findByProviderOrderId.mockResolvedValue(mockPayment);
      tx.order.updateMany.mockResolvedValue({ count: 0 });
      tx.order.findUnique.mockResolvedValue({ status: OrderStatus.CANCELLED });

      await expect(service.verifyPayment('user-uuid-1', dto)).rejects.toThrow(
        OrderNotPayableException,
      );
      expect(tx.payment.update).toHaveBeenCalled();
      expect(tx.inventory.update).not.toHaveBeenCalled();
    });
  });

  describe('getPaymentByOrderId', () => {
    it('returns payment when found', async () => {
      paymentRepository.findByOrderId.mockResolvedValue(mockPayment);
      const result = await service.getPaymentByOrderId('order-uuid-1');
      expect(result?.id).toBe('pay-uuid-1');
      expect(result?.amount).toBe(1999);
    });

    it('returns null when no payment found', async () => {
      paymentRepository.findByOrderId.mockResolvedValue(null);
      const result = await service.getPaymentByOrderId('unknown-order');
      expect(result).toBeNull();
    });
  });
});
