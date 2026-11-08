import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { InvoiceEmailStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MailerService } from '@/mailer/mailer.service';
import { ORDER_NOTIFICATION_QUEUE } from './order-notification.queue.constants';
import { OrderNotificationService } from './order-notification.service';

describe('OrderNotificationService', () => {
  let service: OrderNotificationService;
  let mockPrisma: any;
  let mockMailer: { sendOrderUpdateEmail: jest.Mock };
  let mockQueue: { add: jest.Mock; getJob: jest.Mock };

  beforeEach(async () => {
    mockPrisma = {
      orderNotificationDelivery: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    mockMailer = {
      sendOrderUpdateEmail: jest.fn().mockResolvedValue(undefined),
    };
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
      getJob: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderNotificationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailerService, useValue: mockMailer },
        { provide: getQueueToken(ORDER_NOTIFICATION_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get(OrderNotificationService);
  });

  it('enqueues a BullMQ job with a deterministic jobId', async () => {
    await service.enqueueDeliveryJob('order-1', 'deliv-1');

    expect(mockQueue.add).toHaveBeenCalledWith(
      'send-order-notification',
      { orderId: 'order-1', deliveryId: 'deliv-1' },
      expect.objectContaining({
        jobId: 'order-notification-deliv-1',
        attempts: 4,
      }),
    );
  });

  it('skips sending when delivery is already marked SENT', async () => {
    mockPrisma.orderNotificationDelivery.findUnique.mockResolvedValue({
      id: 'deliv-1',
      orderId: 'order-1',
      status: InvoiceEmailStatus.SENT,
    });

    await service.processDeliveryJob({
      orderId: 'order-1',
      deliveryId: 'deliv-1',
      attemptNumber: 1,
      maxAttempts: 4,
    });

    expect(mockMailer.sendOrderUpdateEmail).not.toHaveBeenCalled();
    expect(mockPrisma.orderNotificationDelivery.update).not.toHaveBeenCalled();
  });

  it('sends email and transitions delivery status to SENT on success', async () => {
    mockPrisma.orderNotificationDelivery.findUnique.mockResolvedValue({
      id: 'deliv-1',
      orderId: '11112222-3333-4444-5555-666677778888',
      recipient: 'customer@example.com',
      status: InvoiceEmailStatus.PENDING,
      activity: {
        eventType: 'CUSTOMER_UPDATE',
        updateCategory: 'MANUFACTURING_UPDATE',
        description: 'Your sofa frame is assembled.',
        order: {
          id: '11112222-3333-4444-5555-666677778888',
          status: OrderStatus.PROCESSING,
          shippingAddress: { firstName: 'Rohan', lastName: 'Sharma' },
          user: { name: 'Rohan Sharma', email: 'customer@example.com' },
        },
      },
    });

    await service.processDeliveryJob({
      orderId: '11112222-3333-4444-5555-666677778888',
      deliveryId: 'deliv-1',
      attemptNumber: 1,
      maxAttempts: 4,
    });

    expect(mockMailer.sendOrderUpdateEmail).toHaveBeenCalledWith({
      to: 'customer@example.com',
      customerName: 'Rohan Sharma',
      orderNumber: '#TMB-11112222',
      orderStatus: OrderStatus.PROCESSING,
      updateCategory: 'MANUFACTURING_UPDATE',
      message: 'Your sofa frame is assembled.',
    });
    expect(mockPrisma.orderNotificationDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'deliv-1' },
        data: expect.objectContaining({
          status: InvoiceEmailStatus.SENT,
          lastError: null,
        }),
      }),
    );
  });

  it('keeps status PENDING on transient failure and marks FAILED on final attempt', async () => {
    const record = {
      id: 'deliv-1',
      orderId: '11112222-3333-4444-5555-666677778888',
      recipient: 'customer@example.com',
      status: InvoiceEmailStatus.PENDING,
      activity: {
        eventType: 'CUSTOMER_UPDATE',
        updateCategory: 'DELAY_NOTIFICATION',
        description: 'Slight delay in polishing.',
        order: {
          id: '11112222-3333-4444-5555-666677778888',
          status: OrderStatus.PROCESSING,
          shippingAddress: {},
          user: { name: 'Rohan', email: 'customer@example.com' },
        },
      },
    };
    mockPrisma.orderNotificationDelivery.findUnique.mockResolvedValue(record);
    mockMailer.sendOrderUpdateEmail.mockRejectedValue(new Error('SMTP timeout'));

    await expect(
      service.processDeliveryJob({
        orderId: record.orderId,
        deliveryId: 'deliv-1',
        attemptNumber: 1,
        maxAttempts: 4,
      }),
    ).rejects.toThrow('SMTP timeout');

    expect(mockPrisma.orderNotificationDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: InvoiceEmailStatus.PENDING,
          lastError: 'SMTP timeout',
        }),
      }),
    );

    await expect(
      service.processDeliveryJob({
        orderId: record.orderId,
        deliveryId: 'deliv-1',
        attemptNumber: 4,
        maxAttempts: 4,
      }),
    ).rejects.toThrow('SMTP timeout');

    expect(mockPrisma.orderNotificationDelivery.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: InvoiceEmailStatus.FAILED,
          lastError: 'SMTP timeout',
        }),
      }),
    );
  });
});
