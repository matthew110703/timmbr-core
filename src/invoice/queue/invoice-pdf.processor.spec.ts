import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from '@/media/media.service';
import { InvoicePdfStatus } from '@prisma/client';
import { InvoiceRepository } from '../invoice.repository';
import { PdfRendererService } from '../pdf/pdf-renderer.service';
import { InvoiceEmailService } from '../email/invoice-email.service';
import { InvoicePdfProcessor } from './invoice-pdf.processor';

describe('InvoicePdfProcessor', () => {
  let processor: InvoicePdfProcessor;
  let invoiceRepo: jest.Mocked<InvoiceRepository>;
  let pdfRenderer: jest.Mocked<PdfRendererService>;
  let mediaService: jest.Mocked<MediaService>;
  let emailService: jest.Mocked<InvoiceEmailService>;

  const mockInvoice: any = {
    id: 'inv-uuid-1',
    invoiceNumber: 'INV/26-27/000001',
    pdfStatus: InvoicePdfStatus.PENDING,
    pdfGenerationVersion: 1,
    storageKey: null,
    items: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicePdfProcessor,
        {
          provide: InvoiceRepository,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockInvoice),
            updatePdfStateForVersion: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: PdfRendererService,
          useValue: {
            renderInvoicePdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock')),
          },
        },
        {
          provide: MediaService,
          useValue: {
            exists: jest.fn().mockResolvedValue(false),
            putBuffer: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: InvoiceEmailService,
          useValue: {
            enqueueAutomaticEmailIfNeeded: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    processor = module.get<InvoicePdfProcessor>(InvoicePdfProcessor);
    invoiceRepo = module.get(InvoiceRepository);
    pdfRenderer = module.get(PdfRendererService);
    mediaService = module.get(MediaService);
    emailService = module.get(InvoiceEmailService);
  });

  it('renders PDF, uploads to versioned R2 key, updates DB to READY, and triggers email job', async () => {
    const job: any = {
      id: 'invoice-pdf-inv-uuid-1-v1',
      data: { invoiceId: 'inv-uuid-1', version: 1 },
      attemptsMade: 0,
      opts: { attempts: 5 },
    };

    await processor.process(job);

    expect(pdfRenderer.renderInvoicePdf).toHaveBeenCalledWith(mockInvoice);
    expect(mediaService.putBuffer).toHaveBeenCalledWith({
      key: 'invoices/inv-uuid-1/versions/1/invoice.pdf',
      body: expect.any(Buffer),
      contentType: 'application/pdf',
    });
    expect(invoiceRepo.updatePdfStateForVersion).toHaveBeenLastCalledWith(
      'inv-uuid-1',
      1,
      expect.objectContaining({
        pdfStatus: InvoicePdfStatus.READY,
        storageKey: 'invoices/inv-uuid-1/versions/1/invoice.pdf',
        pdfLastError: null,
      }),
    );
    expect(emailService.enqueueAutomaticEmailIfNeeded).toHaveBeenCalledWith('inv-uuid-1');
  });

  it('skips stale jobs when job version is older than active pdfGenerationVersion', async () => {
    invoiceRepo.findById.mockResolvedValueOnce({
      ...mockInvoice,
      pdfGenerationVersion: 3,
    });

    const job: any = {
      id: 'invoice-pdf-inv-uuid-1-v1',
      data: { invoiceId: 'inv-uuid-1', version: 1 },
      attemptsMade: 0,
      opts: { attempts: 5 },
    };

    await processor.process(job);

    expect(pdfRenderer.renderInvoicePdf).not.toHaveBeenCalled();
    expect(mediaService.putBuffer).not.toHaveBeenCalled();
    expect(invoiceRepo.updatePdfStateForVersion).not.toHaveBeenCalled();
  });

  it('recovers without re-rendering if R2 upload already succeeded in a prior crashed attempt', async () => {
    mediaService.exists.mockResolvedValueOnce(true);

    const job: any = {
      id: 'invoice-pdf-inv-uuid-1-v1',
      data: { invoiceId: 'inv-uuid-1', version: 1 },
      attemptsMade: 1,
      opts: { attempts: 5 },
    };

    await processor.process(job);

    expect(pdfRenderer.renderInvoicePdf).not.toHaveBeenCalled();
    expect(mediaService.putBuffer).not.toHaveBeenCalled();
    expect(invoiceRepo.updatePdfStateForVersion).toHaveBeenLastCalledWith(
      'inv-uuid-1',
      1,
      expect.objectContaining({
        pdfStatus: InvoicePdfStatus.READY,
        storageKey: 'invoices/inv-uuid-1/versions/1/invoice.pdf',
      }),
    );
  });

  it('deletes previous version from R2 when a newer version succeeds (latest successful PDF only)', async () => {
    invoiceRepo.findById.mockResolvedValueOnce({
      ...mockInvoice,
      pdfGenerationVersion: 2,
      storageKey: 'invoices/inv-uuid-1/versions/1/invoice.pdf',
    });

    const job: any = {
      id: 'invoice-pdf-inv-uuid-1-v2',
      data: { invoiceId: 'inv-uuid-1', version: 2, force: true },
      attemptsMade: 0,
      opts: { attempts: 5 },
    };

    await processor.process(job);

    expect(mediaService.delete).toHaveBeenCalledWith('invoices/inv-uuid-1/versions/1/invoice.pdf');
  });

  it('cleans up R2 object and does not overwrite DB if version changed while rendering', async () => {
    invoiceRepo.updatePdfStateForVersion
      .mockResolvedValueOnce(1) // PROCESSING succeeded
      .mockResolvedValueOnce(0); // READY rejected because version incremented to 2 concurrently

    const job: any = {
      id: 'invoice-pdf-inv-uuid-1-v1',
      data: { invoiceId: 'inv-uuid-1', version: 1 },
      attemptsMade: 0,
      opts: { attempts: 5 },
    };

    await processor.process(job);

    expect(mediaService.delete).toHaveBeenCalledWith('invoices/inv-uuid-1/versions/1/invoice.pdf');
    expect(emailService.enqueueAutomaticEmailIfNeeded).not.toHaveBeenCalled();
  });

  it('marks pdfStatus as FAILED when retries are exhausted', async () => {
    pdfRenderer.renderInvoicePdf.mockRejectedValueOnce(new Error('Chromium crash'));

    const job: any = {
      id: 'invoice-pdf-inv-uuid-1-v1',
      data: { invoiceId: 'inv-uuid-1', version: 1 },
      attemptsMade: 4, // 5th and final attempt
      opts: { attempts: 5 },
    };

    await expect(processor.process(job)).rejects.toThrow('Chromium crash');

    expect(invoiceRepo.updatePdfStateForVersion).toHaveBeenLastCalledWith(
      'inv-uuid-1',
      1,
      expect.objectContaining({
        pdfStatus: InvoicePdfStatus.FAILED,
        pdfLastError: 'Chromium crash',
      }),
    );
  });
});
