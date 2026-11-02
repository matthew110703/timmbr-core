import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RazorpayService } from '@/payment/razorpay.service';
import { PaymentRepository } from '@/payment/payment.repository';
import { WebhookRepository } from './webhook.repository';
import { InvoiceIssuanceService } from '@/invoice/invoice-issuance.service';
import { OrderStatus, PaymentStatus } from '@prisma/client';

describe('WebhookService', () => {
  let service: WebhookService;
  let razorpayService: jest.Mocked<RazorpayService>;
  let paymentRepository: jest.Mocked<PaymentRepository>;
  let webhookRepository: jest.Mocked<WebhookRepository>;
  let invoiceIssuanceService: jest.Mocked<InvoiceIssuanceService>;

  let tx: any;

  beforeEach(async () => {
    tx = {
      payment: {
        update: jest.fn().mockResolvedValue({
          id: 'pay-uuid-1',
          orderId: 'order-uuid-1',
          status: PaymentStatus.PAID,
        }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-uuid-1',
          cartId: 'cart-uuid-1',
          status: OrderStatus.PENDING,
          items: [{ variantId: 'var-1', quantity: 1 }],
        }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventory: {
        findUnique: jest.fn().mockResolvedValue({ id: 'inv-1', quantity: 5, reservedQuantity: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryTransaction: {
        create: jest.fn().mockResolvedValue({}),
      },
      cart: { update: jest.fn().mockResolvedValue({}) },
    };

    const mockPrisma = {
      $transaction: jest.fn((cb) => cb(tx)),
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

    const mockInvoiceIssuance = {
      issueForConfirmedOrderInTx: jest.fn().mockResolvedValue({
        id: 'inv-uuid-1',
        invoiceNumber: 'INV/26-27/000001',
      }),
      issueForConfirmedOrderSafely: jest.fn().mockResolvedValue({
        id: 'inv-uuid-1',
        invoiceNumber: 'INV/26-27/000001',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RazorpayService, useValue: mockRazorpay },
        { provide: PaymentRepository, useValue: mockPaymentRepo },
        { provide: WebhookRepository, useValue: mockWebhookRepo },
        { provide: InvoiceIssuanceService, useValue: mockInvoiceIssuance },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    razorpayService = module.get(RazorpayService);
    paymentRepository = module.get(PaymentRepository);
    webhookRepository = module.get(WebhookRepository);
    invoiceIssuanceService = module.get(InvoiceIssuanceService);
  });

  it('handles payment.captured event, confirms payment and order, and issues invoice in tx', async () => {
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
    expect(tx.cart.update).toHaveBeenCalledWith({
      where: { id: 'cart-uuid-1' },
      data: { status: 'CONVERTED' },
    });
    expect(invoiceIssuanceService.issueForConfirmedOrderSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-uuid-1',
      }),
    );
  });

  it('leaves the cart alone and does not issue invoice when the order was no longer PENDING', async () => {
    webhookRepository.findEvent.mockResolvedValue(null);
    paymentRepository.findByProviderOrderId.mockResolvedValue({
      id: 'pay-uuid-1',
      orderId: 'order-uuid-1',
      status: PaymentStatus.PENDING,
    } as any);
    tx.order.updateMany.mockResolvedValue({ count: 0 });

    const payload = {
      id: 'evt_late',
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_rzp_123', order_id: 'order_rzp_123' } } },
    };
    await service.handleRazorpayWebhook(JSON.stringify(payload), 'sig_123', payload);

    expect(tx.cart.update).not.toHaveBeenCalled();
    expect(invoiceIssuanceService.issueForConfirmedOrderSafely).not.toHaveBeenCalled();
  });

  it('does not issue invoice on payment.failed events', async () => {
    webhookRepository.findEvent.mockResolvedValue(null);
    paymentRepository.findByProviderOrderId.mockResolvedValue({
      id: 'pay-uuid-1',
      orderId: 'order-uuid-1',
      status: PaymentStatus.PENDING,
    } as any);

    const payload = {
      id: 'evt_failed',
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_rzp_123', order_id: 'order_rzp_123' } } },
    };
    await service.handleRazorpayWebhook(JSON.stringify(payload), 'sig_123', payload);

    expect(paymentRepository.update).toHaveBeenCalledWith(
      'pay-uuid-1',
      expect.objectContaining({ status: PaymentStatus.FAILED }),
    );
    expect(invoiceIssuanceService.issueForConfirmedOrderSafely).not.toHaveBeenCalled();
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
    expect(invoiceIssuanceService.issueForConfirmedOrderSafely).not.toHaveBeenCalled();
  });
});
