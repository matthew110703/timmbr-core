import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RazorpayService } from './razorpay.service';
import { PaymentRepository } from './payment.repository';
import { PaymentNotFoundException } from '@/common/exceptions/payment.exception';
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

  beforeEach(async () => {
    const mockPrisma = {
      order: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((cb) => {
        const tx = {
          payment: {
            update: jest.fn().mockResolvedValue({
              ...mockPayment,
              status: PaymentStatus.PAID,
              providerPaymentId: 'pay_rzp_123',
            }),
          },
          order: {
            update: jest.fn().mockResolvedValue({
              id: 'order-uuid-1',
              status: OrderStatus.CONFIRMED,
              items: [
                {
                  id: 'item-uuid-1',
                  variantId: 'variant-uuid-1',
                  quantity: 2,
                },
              ],
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
          inventoryTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      }),
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

      const result = await service.verifyPayment({
        razorpayOrderId: 'order_rzp_123',
        razorpayPaymentId: 'pay_rzp_123',
        razorpaySignature: 'sig_123',
      });

      expect(razorpayService.verifyPaymentSignature).toHaveBeenCalled();
      expect(result.payment.status).toBe(PaymentStatus.PAID);
      expect(result.orderStatus).toBe(OrderStatus.CONFIRMED);
      expect(result.orderId).toBe('order-uuid-1');
    });

    it('throws PaymentNotFoundException when provider order id is not found', async () => {
      paymentRepository.findByProviderOrderId.mockResolvedValue(null);

      await expect(
        service.verifyPayment({
          razorpayOrderId: 'unknown_order',
          razorpayPaymentId: 'pay_123',
          razorpaySignature: 'sig_123',
        }),
      ).rejects.toThrow(PaymentNotFoundException);
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
