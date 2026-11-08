import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigModule } from '@/config/config.module';
import { LoggerModule } from '@/common/logger/logger.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { MediaModule } from '@/media/media.module';
import { MailerModule } from '@/mailer/mailer.module';
import { env } from '@/config/env';
import { INVOICE_EMAIL_QUEUE, INVOICE_PDF_QUEUE } from './queue/invoice.queue.constants';
import { ORDER_NOTIFICATION_QUEUE } from '@/order/queue/order-notification.queue.constants';
import { OrderNotificationService } from '@/order/queue/order-notification.service';
import { OrderNotificationProcessor } from '@/order/queue/order-notification.processor';
import { InvoiceRepository } from './invoice.repository';
import { InvoiceEmailService } from './email/invoice-email.service';
import { OutboxDispatcherService } from './outbox/outbox-dispatcher.service';
import { PdfRendererService } from './pdf/pdf-renderer.service';
import { InvoicePdfProcessor } from './queue/invoice-pdf.processor';
import { InvoiceEmailProcessor } from './email/invoice-email.processor';

/**
 * Dedicated standalone worker module initialized by `src/worker.ts`.
 * Boots only the infrastructure needed for transactional outbox dispatch,
 * Playwright Chromium PDF rendering, R2 uploads, and invoice email delivery.
 */
@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    PrismaModule,
    MediaModule,
    MailerModule,
    BullModule.forRoot({
      connection: {
        url: env.REDIS_URL,
        maxRetriesPerRequest: null,
      },
    }),
    BullModule.registerQueue(
      { name: INVOICE_PDF_QUEUE },
      { name: INVOICE_EMAIL_QUEUE },
      { name: ORDER_NOTIFICATION_QUEUE },
    ),
  ],
  providers: [
    InvoiceRepository,
    InvoiceEmailService,
    OrderNotificationService,
    OutboxDispatcherService,
    PdfRendererService,
    InvoicePdfProcessor,
    InvoiceEmailProcessor,
    OrderNotificationProcessor,
  ],
})
export class InvoiceWorkerModule {}
