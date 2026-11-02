import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { MediaService } from '@/media/media.service';
import { MailerService } from '@/mailer/mailer.service';
import { InvoiceEmailStatus, InvoicePdfStatus, Prisma } from '@prisma/client';
import { InvoicePdfNotReadyException } from '@/common/exceptions/invoice.exception';
import { INVOICE_EMAIL_QUEUE } from '../queue/invoice.queue.constants';
import { InvoiceEmailService } from './invoice-email.service';

describe('InvoiceEmailService', () => {
  let service: InvoiceEmailService;
  let mockPrisma: any;
  let mediaService: jest.Mocked<MediaService>;
  let mailerService: jest.Mocked<MailerService>;
  let emailQueue: { add: jest.Mock; getJob: jest.Mock };

  const readyInvoice: any = {
    id: 'inv-uuid-1',
    invoiceNumber: 'INV/26-27/000001',
    pdfStatus: InvoicePdfStatus.READY,
    storageKey: 'invoices/inv-uuid-1/versions/1/invoice.pdf',
    customerEmail: 'customer@example.com',
    issuedAt: new Date('2026-06-02T10:00:00.000Z'),
    grandTotal: new Prisma.Decimal('2224.00'),
    billingAddress: { name: 'Aarav Sharma' },
  };

  beforeEach(async () => {
    mockPrisma = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue(readyInvoice),
        update: jest.fn().mockResolvedValue({}),
      },
      invoiceEmailDelivery: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'deliv-uuid-1',
            attempts: 0,
            lastError: null,
            lastAttemptAt: null,
            sentAt: null,
            createdAt: new Date(),
            ...data,
          }),
        ),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((arg) => {
        if (typeof arg === 'function') {
          return arg(mockPrisma);
        }
        return Promise.all(arg);
      }),
    };

    emailQueue = {
      add: jest.fn().mockResolvedValue({ id: 'email-job-1' }),
      getJob: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceEmailService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: MediaService,
          useValue: {
            getBuffer: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test')),
          },
        },
        {
          provide: MailerService,
          useValue: {
            sendInvoiceEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: getQueueToken(INVOICE_EMAIL_QUEUE), useValue: emailQueue },
      ],
    }).compile();

    service = module.get<InvoiceEmailService>(InvoiceEmailService);
    mediaService = module.get(MediaService);
    mailerService = module.get(MailerService);
  });

  it('enqueues automatic email when PDF is READY and prevents duplicate automatic deliveries', async () => {
    const first = await service.enqueueAutomaticEmailIfNeeded('inv-uuid-1');
    expect(first?.recipient).toBe('customer@example.com');
    expect(emailQueue.add).toHaveBeenCalledTimes(1);

    // Second call when already SENT skips enqueueing
    mockPrisma.invoiceEmailDelivery.findFirst.mockResolvedValueOnce({
      id: 'deliv-uuid-1',
      invoiceId: 'inv-uuid-1',
      status: InvoiceEmailStatus.SENT,
      isOverride: false,
    });

    emailQueue.add.mockClear();
    await service.enqueueAutomaticEmailIfNeeded('inv-uuid-1');
    expect(emailQueue.add).not.toHaveBeenCalled();

    // When a stuck PENDING delivery exists and a prior failed BullMQ job is in Redis, removes it before re-enqueueing
    const removeMock = jest.fn().mockResolvedValue(undefined);
    emailQueue.getJob.mockResolvedValueOnce({
      getState: jest.fn().mockResolvedValue('failed'),
      remove: removeMock,
    });
    mockPrisma.invoiceEmailDelivery.findFirst.mockResolvedValueOnce({
      id: 'deliv-uuid-1',
      invoiceId: 'inv-uuid-1',
      recipient: 'customer@example.com',
      status: InvoiceEmailStatus.PENDING,
      isOverride: false,
    });

    await service.enqueueAutomaticEmailIfNeeded('inv-uuid-1');
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(emailQueue.add).toHaveBeenCalledTimes(1);
  });

  it('supports admin manual resend with recipient override without mutating invoice snapshot', async () => {
    const delivery = await service.enqueueAdminResend({
      invoiceId: 'inv-uuid-1',
      requestedById: 'admin-1',
      recipientOverride: 'accounts@buyer.com',
    });

    expect(delivery.recipient).toBe('accounts@buyer.com');
    expect(delivery.isOverride).toBe(true);
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-uuid-1' },
      data: {
        emailStatus: InvoiceEmailStatus.PENDING,
        emailLastRecipient: 'accounts@buyer.com',
      },
    });
  });

  it('rejects admin resend when PDF is not READY', async () => {
    mockPrisma.invoice.findUnique.mockResolvedValueOnce({
      ...readyInvoice,
      pdfStatus: InvoicePdfStatus.PENDING,
    });

    await expect(
      service.enqueueAdminResend({
        invoiceId: 'inv-uuid-1',
        requestedById: 'admin-1',
      }),
    ).rejects.toThrow(InvoicePdfNotReadyException);
  });

  it('downloads PDF buffer from R2 and sends email with PDF attachment', async () => {
    mockPrisma.invoiceEmailDelivery.findUnique.mockResolvedValueOnce({
      id: 'deliv-uuid-1',
      invoiceId: 'inv-uuid-1',
      recipient: 'customer@example.com',
      status: InvoiceEmailStatus.PENDING,
    });

    await service.processDeliveryJob({
      invoiceId: 'inv-uuid-1',
      deliveryId: 'deliv-uuid-1',
      attemptNumber: 1,
      maxAttempts: 4,
    });

    expect(mediaService.getBuffer).toHaveBeenCalledWith(
      'invoices/inv-uuid-1/versions/1/invoice.pdf',
    );
    expect(mailerService.sendInvoiceEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        invoiceNumber: 'INV/26-27/000001',
        pdfBuffer: expect.any(Buffer),
      }),
    );
  });

  it('marks emailStatus FAILED on final attempt without modifying invoice status or pdfStatus', async () => {
    mockPrisma.invoiceEmailDelivery.findUnique.mockResolvedValueOnce({
      id: 'deliv-uuid-1',
      invoiceId: 'inv-uuid-1',
      recipient: 'customer@example.com',
      status: InvoiceEmailStatus.PENDING,
    });
    mailerService.sendInvoiceEmail.mockRejectedValueOnce(new Error('Resend API outage'));

    await expect(
      service.processDeliveryJob({
        invoiceId: 'inv-uuid-1',
        deliveryId: 'deliv-uuid-1',
        attemptNumber: 4,
        maxAttempts: 4,
      }),
    ).rejects.toThrow('Resend API outage');

    expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-uuid-1' },
      data: expect.objectContaining({
        emailStatus: InvoiceEmailStatus.FAILED,
        emailLastError: 'Resend API outage',
      }),
    });
  });
});
