import { Module, Provider } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@/prisma/prisma.module';
import { MediaModule } from '@/media/media.module';
import { MailerModule } from '@/mailer/mailer.module';
import { env } from '@/config/env';
import { INVOICE_EMAIL_QUEUE, INVOICE_PDF_QUEUE } from './queue/invoice.queue.constants';
import { InvoiceRepository } from './invoice.repository';
import { InvoiceIssuanceService } from './invoice-issuance.service';
import { InvoiceService } from './invoice.service';
import { InvoiceEmailService } from './email/invoice-email.service';
import { InvoiceController } from './controllers/invoice.controller';
import { InvoiceAdminController } from './controllers/invoice.admin.controller';
import { OutboxDispatcherService } from './outbox/outbox-dispatcher.service';
import { PdfRendererService } from './pdf/pdf-renderer.service';
import { InvoicePdfProcessor } from './queue/invoice-pdf.processor';
import { InvoiceEmailProcessor } from './email/invoice-email.processor';

/**
 * Determines whether the Outbox Dispatcher and BullMQ workers should run inside the API process.
 * - In `prod`, defaults to `false` so the dedicated `src/worker.ts` process handles all background work.
 * - In `dev`, defaults to `true` for convenient single-process local development unless overridden.
 * - In `test`, defaults to `false`.
 */
export function isInvoiceWorkerEnabledInApi(): boolean {
  if (env.INVOICE_WORKER_IN_API !== undefined) {
    return env.INVOICE_WORKER_IN_API === 'true';
  }
  return env.NODE_ENV === 'dev';
}

const workerProviders: Provider[] = isInvoiceWorkerEnabledInApi()
  ? [OutboxDispatcherService, PdfRendererService, InvoicePdfProcessor, InvoiceEmailProcessor]
  : [];

@Module({
  imports: [
    PrismaModule,
    MediaModule,
    MailerModule,
    BullModule.forRoot({
      connection: {
        url: env.REDIS_URL,
        maxRetriesPerRequest: null,
      },
    }),
    BullModule.registerQueue({ name: INVOICE_PDF_QUEUE }, { name: INVOICE_EMAIL_QUEUE }),
  ],
  controllers: [InvoiceController, InvoiceAdminController],
  providers: [
    InvoiceRepository,
    InvoiceIssuanceService,
    InvoiceEmailService,
    InvoiceService,
    ...workerProviders,
  ],
  exports: [InvoiceRepository, InvoiceIssuanceService, InvoiceEmailService, InvoiceService],
})
export class InvoiceModule {}
