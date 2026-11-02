import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MediaService } from '@/media/media.service';
import { InvoicePdfStatus } from '@prisma/client';
import { InvoiceRepository } from '../invoice.repository';
import { PdfRendererService } from '../pdf/pdf-renderer.service';
import { InvoiceEmailService } from '../email/invoice-email.service';
import {
  buildInvoiceVersionStorageKey,
  INVOICE_PDF_QUEUE,
  InvoicePdfJobPayload,
} from './invoice.queue.constants';
import { INVOICE_PDF_MAX_ATTEMPTS } from '../outbox/outbox-dispatcher.service';

@Processor(INVOICE_PDF_QUEUE, { concurrency: 2 })
export class InvoicePdfProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoicePdfProcessor.name);

  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly pdfRendererService: PdfRendererService,
    private readonly mediaService: MediaService,
    private readonly invoiceEmailService: InvoiceEmailService,
  ) {
    super();
  }

  async process(job: Job<InvoicePdfJobPayload>): Promise<void> {
    const { invoiceId, version, force } = job.data;
    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? INVOICE_PDF_MAX_ATTEMPTS;

    // 1. Load immutable invoice and items
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) {
      this.logger.warn(
        { jobId: job.id, invoiceId, version },
        'Invoice not found for PDF generation job — skipping',
      );
      return;
    }

    // 2. Verify generation version (skip stale jobs)
    if (version < invoice.pdfGenerationVersion) {
      this.logger.warn(
        {
          jobId: job.id,
          invoiceId,
          jobVersion: version,
          activeVersion: invoice.pdfGenerationVersion,
        },
        'Skipping stale PDF generation job for older version',
      );
      return;
    }

    const versionStorageKey = buildInvoiceVersionStorageKey(invoiceId, version);
    const previousStorageKey = invoice.storageKey;

    // 3. If PDF is already READY for this version and object exists in R2, ensure email is queued and exit
    if (
      !force &&
      invoice.pdfStatus === InvoicePdfStatus.READY &&
      invoice.storageKey === versionStorageKey
    ) {
      const existsInR2 = await this.mediaService.exists(versionStorageKey);
      if (existsInR2) {
        this.logger.log(
          { invoiceId, version, storageKey: versionStorageKey },
          'Invoice PDF is already READY in R2 — ensuring email delivery is enqueued',
        );
        await this.invoiceEmailService.enqueueAutomaticEmailIfNeeded(invoiceId);
        return;
      }
    }

    // 4. Mark PROCESSING conditionally for active version
    const markedCount = await this.invoiceRepository.updatePdfStateForVersion(invoiceId, version, {
      pdfStatus: InvoicePdfStatus.PROCESSING,
      incrementAttempts: true,
    });

    if (markedCount === 0) {
      this.logger.warn(
        { invoiceId, version },
        'Invoice pdfGenerationVersion changed before PROCESSING transition — aborting stale worker',
      );
      return;
    }

    try {
      // 5. Crash recovery check: if a previous worker attempt already uploaded this exact version's
      //    PDF to R2 before crashing prior to the DB update, reuse it without re-rendering!
      const alreadyUploadedForVersion =
        !force && (await this.mediaService.exists(versionStorageKey));

      if (!alreadyUploadedForVersion) {
        const pdfBuffer = await this.pdfRendererService.renderInvoicePdf(invoice);
        await this.mediaService.putBuffer({
          key: versionStorageKey,
          body: pdfBuffer,
          contentType: 'application/pdf',
        });
      } else {
        this.logger.log(
          { invoiceId, version, storageKey: versionStorageKey },
          'Recovered existing R2 PDF object from prior interrupted attempt without re-rendering',
        );
      }

      // 6. Conditional database update: only the currently active version can update storageKey & READY
      const updatedCount = await this.invoiceRepository.updatePdfStateForVersion(
        invoiceId,
        version,
        {
          pdfStatus: InvoicePdfStatus.READY,
          storageKey: versionStorageKey,
          pdfGeneratedAt: new Date(),
          pdfLastError: null,
        },
      );

      if (updatedCount === 0) {
        this.logger.warn(
          { invoiceId, version, storageKey: versionStorageKey },
          'Stale PDF worker completed after newer version was requested — cleaning up stale R2 object',
        );
        await this.mediaService
          .delete(versionStorageKey)
          .catch((delErr) =>
            this.logger.warn(
              { invoiceId, storageKey: versionStorageKey, err: delErr },
              'Failed to clean up superseded PDF version from R2',
            ),
          );
        return;
      }

      // 7. Retention policy: retain only the latest successful PDF version
      if (previousStorageKey && previousStorageKey !== versionStorageKey) {
        await this.mediaService
          .delete(previousStorageKey)
          .catch((delErr) =>
            this.logger.warn(
              { invoiceId, previousStorageKey, err: delErr },
              'Failed to delete previous PDF version from R2 after version upgrade',
            ),
          );
      }

      this.logger.log(
        {
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          version,
          storageKey: versionStorageKey,
        },
        'Invoice PDF generated and marked READY',
      );

      // 8. Trigger invoice email delivery after PDF becomes READY (never fail PDF job if email enqueue fails)
      await this.invoiceEmailService
        .enqueueAutomaticEmailIfNeeded(invoiceId)
        .catch((emailErr) =>
          this.logger.error(
            { invoiceId, err: emailErr },
            'Failed to enqueue automatic invoice email after PDF became READY',
          ),
        );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isFinalAttempt = attemptNumber >= maxAttempts;

      await this.invoiceRepository.updatePdfStateForVersion(invoiceId, version, {
        pdfStatus: isFinalAttempt ? InvoicePdfStatus.FAILED : InvoicePdfStatus.PENDING,
        pdfLastError: errorMessage,
      });

      this.logger.error(
        {
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          version,
          attemptNumber,
          maxAttempts,
          isFinalAttempt,
          err: errorMessage,
        },
        isFinalAttempt
          ? 'Invoice PDF generation exhausted all retries and transitioned to FAILED'
          : 'Invoice PDF generation attempt failed; BullMQ will retry with backoff',
      );

      throw error;
    }
  }
}
