import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { INVOICE_EMAIL_QUEUE, InvoiceEmailJobPayload } from '../queue/invoice.queue.constants';
import { INVOICE_EMAIL_MAX_ATTEMPTS, InvoiceEmailService } from './invoice-email.service';

@Processor(INVOICE_EMAIL_QUEUE, { concurrency: 3 })
export class InvoiceEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoiceEmailProcessor.name);

  constructor(private readonly invoiceEmailService: InvoiceEmailService) {
    super();
  }

  async process(job: Job<InvoiceEmailJobPayload>): Promise<void> {
    const { invoiceId, deliveryId } = job.data;
    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? INVOICE_EMAIL_MAX_ATTEMPTS;

    this.logger.log(
      { jobId: job.id, invoiceId, deliveryId, attemptNumber, maxAttempts },
      'Processing invoice email delivery job',
    );

    await this.invoiceEmailService.processDeliveryJob({
      invoiceId,
      deliveryId,
      attemptNumber,
      maxAttempts,
    });
  }
}
