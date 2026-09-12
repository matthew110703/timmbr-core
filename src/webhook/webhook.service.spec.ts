import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RazorpayService } from '@/payment/razorpay.service';
import { PaymentRepository } from '@/payment/payment.repository';
import { WebhookRepository } from './webhook.repository';
import { OrderStatus, PaymentStatus } from '@prisma/client';

describe('WebhookService', () => {
  let service: WebhookService;
  let razorpayService: jest.Mocked<RazorpayService>;
  let paymentRepository: jest.Mocked<PaymentRepository>;
  let webhookRepository: jest.Mocked<WebhookRepository>;

  beforeEach(async () => {
    const mockPrisma = {
      $transaction: jest.fn((cb) => {
        const tx = {
          payment: { update: jest.fn().mockResolvedValue({}) },
          order: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'order-uuid-1',
              status: OrderStatus.PENDING,
              items: [{ variantId: 'var-1', quantity: 1 }],
            }),
            update: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          inventory: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ id: 'inv-1', quantity: 5, reservedQuantity: 1 }),
            update: jest.fn().mockResolvedValue({}),
          },
          inventoryTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      }),
    };

    const mockRazorpay = {
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
    };

    const mockPaymentRepo = {
      findByProviderOrderId: jest.fn(),
      update: jest.fn(),
    };

    const mockWebhookRepo = {
      findEvent: jest.fn(),
      recordEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RazorpayService, useValue: mockRazorpay },
        { provide: PaymentRepository, useValue: mockPaymentRepo },
        { provide: WebhookRepository, useValue: mockWebhookRepo },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    razorpayService = module.get(RazorpayService);
    paymentRepository = module.get(PaymentRepository);
    webhookRepository = module.get(WebhookRepository);
  });

  it('handles payment.captured event and confirms payment and order', async () => {
    webhookRepository.findEvent.mockResolvedValue(null);
    paymentRepository.findByProviderOrderId.mockResolvedValue({
      id: 'pay-uuid-1',
      orderId: 'order-uuid-1',
      status: PaymentStatus.PENDING,
    } as any);

    const payload = {
      id: 'evt_123456',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_rzp_123',
            order_id: 'order_rzp_123',
          },
        },
      },
    };

    const result = await service.handleRazorpayWebhook(JSON.stringify(payload), 'sig_123', payload);

    expect(razorpayService.verifyWebhookSignature).toHaveBeenCalled();
    expect(webhookRepository.recordEvent).toHaveBeenCalled();
    expect(result.received).toBe(true);
  });

  it('returns idempotent response if event was already processed', async () => {
    webhookRepository.findEvent.mockResolvedValue({
      id: 'wb-1',
      provider: 'RAZORPAY',
      eventId: 'evt_123456',
      eventType: 'payment.captured',
      payload: {},
      processedAt: new Date(),
      createdAt: new Date(),
    });

    const payload = {
      id: 'evt_123456',
      event: 'payment.captured',
    };

    const result = await service.handleRazorpayWebhook(JSON.stringify(payload), 'sig_123', payload);

    expect(result.idempotent).toBe(true);
    expect(result.received).toBe(true);
  });
});
