import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { MediaService } from '@/media/media.service';
import {
  InvoiceEmailStatus,
  InvoicePdfStatus,
  InvoiceStatus,
  Prisma,
  TaxRegime,
} from '@prisma/client';
import {
  InvoiceAlreadyVoidedException,
  InvoiceNotFoundException,
  InvoicePdfAlreadyInProgressException,
  InvoicePdfNotReadyException,
} from '@/common/exceptions/invoice.exception';
import { OrderAccessForbiddenException } from '@/common/exceptions/order.exception';
import { InvoiceRepository } from './invoice.repository';
import { InvoiceEmailService } from './email/invoice-email.service';
import { INVOICE_PDF_QUEUE } from './queue/invoice.queue.constants';
import { InvoiceService } from './invoice.service';

describe('InvoiceService (Customer & Admin APIs, Retry, and Super Admin Void)', () => {
  let service: InvoiceService;
  let mockPrisma: any;
  let invoiceRepo: jest.Mocked<InvoiceRepository>;
  let mediaService: jest.Mocked<MediaService>;
  let pdfQueue: { getJob: jest.Mock };

  const mockInvoice: any = {
    id: 'inv-uuid-1',
    invoiceNumber: 'INV/26-27/000001',
    financialYear: '26-27',
    templateVersion: 'v1',
    orderId: 'order-uuid-1',
    userId: 'user-uuid-1',
    status: InvoiceStatus.ISSUED,
    pdfStatus: InvoicePdfStatus.READY,
    emailStatus: InvoiceEmailStatus.SENT,
    taxRegime: TaxRegime.INTRA_STATE,
    sellerGstin: '29AABCT1234F1Z5',
    sellerState: 'Karnataka',
    sellerStateCode: '29',
    placeOfSupplyState: 'Karnataka',
    placeOfSupplyCode: '29',
    currency: 'INR',
    subtotalGross: new Prisma.Decimal('1180.00'),
    productDiscountTotal: new Prisma.Decimal('0.00'),
    subtotalDiscounted: new Prisma.Decimal('1180.00'),
    subtotalTaxable: new Prisma.Decimal('1000.00'),
    shippingFee: new Prisma.Decimal('0.00'),
    shippingTaxable: new Prisma.Decimal('0.00'),
    shippingTax: new Prisma.Decimal('0.00'),
    cgstTotal: new Prisma.Decimal('90.00'),
    sgstTotal: new Prisma.Decimal('90.00'),
    igstTotal: new Prisma.Decimal('0.00'),
    taxTotal: new Prisma.Decimal('180.00'),
    grandTotal: new Prisma.Decimal('1180.00'),
    customerCode: 'USER01',
    customerEmail: 'user@example.com',
    sellerSnapshot: {},
    billingAddress: { name: 'Aarav Sharma' },
    shippingAddress: {},
    paymentSnapshot: {},
    issuedAt: new Date(),
    storageKey: 'invoices/inv-uuid-1/versions/1/invoice.pdf',
    pdfGenerationVersion: 1,
    pdfGeneratedAt: new Date(),
    pdfAttempts: 1,
    pdfLastError: null,
    emailAttempts: 1,
    emailLastError: null,
    emailLastAttemptAt: new Date(),
    emailSentAt: new Date(),
    emailLastRecipient: 'user@example.com',
    voidedAt: null,
    voidedById: null,
    voidReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };

  beforeEach(async () => {
    mockPrisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-uuid-1',
          userId: 'user-uuid-1',
        }),
      },
      invoice: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...mockInvoice,
          pdfGenerationVersion: 2,
          pdfStatus: InvoicePdfStatus.PENDING,
        }),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'outbox-retry-1' }),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    pdfQueue = {
      getJob: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: InvoiceRepository,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockInvoice),
            findByOrderId: jest.fn().mockResolvedValue(mockInvoice),
            findAdminInvoices: jest.fn().mockResolvedValue([[mockInvoice], 1]),
            voidInvoice: jest.fn().mockResolvedValue({
              ...mockInvoice,
              status: InvoiceStatus.VOID,
              voidedById: 'master-admin-1',
              voidReason: 'Duplicate offline billing adjustment',
              voidedAt: new Date(),
            }),
          },
        },
        {
          provide: MediaService,
          useValue: {
            getPresignedDownloadUrl: jest.fn().mockResolvedValue({
              downloadUrl: 'https://r2.signed.test/invoice.pdf',
              key: mockInvoice.storageKey,
              expiresIn: 300,
            }),
          },
        },
        {
          provide: InvoiceEmailService,
          useValue: {
            enqueueAdminResend: jest.fn(),
          },
        },
        { provide: getQueueToken(INVOICE_PDF_QUEUE), useValue: pdfQueue },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
    invoiceRepo = module.get(InvoiceRepository);
    mediaService = module.get(MediaService);
  });

  it('enforces customer order ownership on invoice details and download endpoints', async () => {
    await expect(
      service.getCustomerInvoiceByOrderId('other-user-id', 'order-uuid-1'),
    ).rejects.toThrow(OrderAccessForbiddenException);

    await expect(
      service.getCustomerInvoiceDownloadUrl('other-user-id', 'order-uuid-1'),
    ).rejects.toThrow(OrderAccessForbiddenException);
  });

  it('returns 409 Conflict (INVOICE_PDF_NOT_READY) when customer requests download before PDF is READY', async () => {
    invoiceRepo.findByOrderId.mockResolvedValueOnce({
      ...mockInvoice,
      pdfStatus: InvoicePdfStatus.PROCESSING,
    });

    await expect(
      service.getCustomerInvoiceDownloadUrl('user-uuid-1', 'order-uuid-1'),
    ).rejects.toThrow(InvoicePdfNotReadyException);
  });

  it('returns a short-lived presigned R2 download URL with invoice filename when READY', async () => {
    const result = await service.getCustomerInvoiceDownloadUrl('user-uuid-1', 'order-uuid-1');

    expect(result).toEqual({
      downloadUrl: 'https://r2.signed.test/invoice.pdf',
      fileName: 'INV_26-27_000001.pdf',
      expiresIn: 300,
    });
    expect(mediaService.getPresignedDownloadUrl).toHaveBeenCalledWith({
      key: 'invoices/inv-uuid-1/versions/1/invoice.pdf',
      downloadFileName: 'INV_26-27_000001.pdf',
      responseContentType: 'application/pdf',
      expiresInSeconds: 300,
    });
  });

  it('atomically increments pdfGenerationVersion and inserts OutboxEvent on admin retry-pdf', async () => {
    const result = await service.retryPdfGeneration('inv-uuid-1', 'admin-1');

    expect(result.pdfGenerationVersion).toBe(2);
    expect(result.pdfStatus).toBe(InvoicePdfStatus.PENDING);
    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: { invoiceId: 'inv-uuid-1', version: 2, force: true },
        }),
      }),
    );
  });

  it('rejects admin retry-pdf when PDF is currently PROCESSING or active in BullMQ', async () => {
    invoiceRepo.findById.mockResolvedValueOnce({
      ...mockInvoice,
      pdfStatus: InvoicePdfStatus.PROCESSING,
    });

    await expect(service.retryPdfGeneration('inv-uuid-1', 'admin-1')).rejects.toThrow(
      InvoicePdfAlreadyInProgressException,
    );

    pdfQueue.getJob.mockResolvedValueOnce({
      getState: jest.fn().mockResolvedValue('active'),
    });

    await expect(service.retryPdfGeneration('inv-uuid-1', 'admin-1')).rejects.toThrow(
      InvoicePdfAlreadyInProgressException,
    );
  });

  it('voids an issued invoice with Super Admin audit metadata and rejects repeated void attempts', async () => {
    const voided = await service.voidInvoice('inv-uuid-1', 'master-admin-1', {
      reason: 'Duplicate offline billing adjustment',
    });

    expect(voided.status).toBe(InvoiceStatus.VOID);
    expect(voided.voidedById).toBe('master-admin-1');
    expect(voided.voidReason).toBe('Duplicate offline billing adjustment');

    invoiceRepo.findById.mockResolvedValueOnce({
      ...mockInvoice,
      status: InvoiceStatus.VOID,
    });

    await expect(
      service.voidInvoice('inv-uuid-1', 'master-admin-1', {
        reason: 'Trying to void a second time',
      }),
    ).rejects.toThrow(InvoiceAlreadyVoidedException);

    invoiceRepo.findById.mockResolvedValueOnce(null);
    await expect(
      service.voidInvoice('missing-id', 'master-admin-1', {
        reason: 'Missing invoice',
      }),
    ).rejects.toThrow(InvoiceNotFoundException);
  });

  it('normalizes date-only "to" filter to end-of-day UTC and uses case-insensitive billingAddress.name search in getAdminInvoices', async () => {
    await service.getAdminInvoices({
      page: 1,
      limit: 20,
      from: '2026-06-01',
      to: '2026-06-02',
      search: 'aarav',
    });

    expect(invoiceRepo.findAdminInvoices).toHaveBeenCalledWith(
      expect.objectContaining({
        issuedAt: {
          gte: new Date('2026-06-01'),
          lte: new Date('2026-06-02T23:59:59.999Z'),
        },
        OR: expect.arrayContaining([
          {
            billingAddress: {
              path: ['name'],
              string_contains: 'aarav',
              mode: 'insensitive',
            },
          },
        ]),
      }),
      1,
      20,
    );
  });
});
