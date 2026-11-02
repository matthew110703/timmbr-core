import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { MediaService } from '@/media/media.service';
import { MailerService } from '@/mailer/mailer.service';
import { InvoiceEmailDelivery, InvoiceEmailStatus, InvoicePdfStatus } from '@prisma/client';
import {
  InvoiceNotFoundException,
  InvoicePdfNotReadyException,
} from '@/common/exceptions/invoice.exception';
import {
  buildInvoiceEmailJobId,
  INVOICE_EMAIL_QUEUE,
  InvoiceEmailJobPayload,
  SEND_INVOICE_EMAIL_JOB,
} from '../queue/invoice.queue.constants';
import { formatInrCurrency, formatInvoiceDateIst } from '../pdf/invoice-html.template';
import { sanitizeInvoicePdfFileName } from '../utils/invoice-number.util';
import { InvoiceAddressSnapshot } from '../invoice-issuance.service';

export const INVOICE_EMAIL_MAX_ATTEMPTS = 4;
export const INVOICE_EMAIL_BACKOFF_DELAY_MS = 3000;

@Injectable()
export class InvoiceEmailService {
  private readonly logger = new Logger(InvoiceEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
    private readonly mailerService: MailerService,
    @InjectQueue(INVOICE_EMAIL_QUEUE)
    private readonly emailQueue: Queue<InvoiceEmailJobPayload>,
  ) {}

  /**
   * Enqueues the initial automatic invoice email once the PDF is `READY`.
   * Idempotent: if an automatic (non-override) email delivery already exists in `PENDING` or `SENT`
   * status for this invoice, re-enqueues or skips without creating a duplicate delivery record.
   */
  async enqueueAutomaticEmailIfNeeded(invoiceId: string): Promise<InvoiceEmailDelivery | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice || invoice.pdfStatus !== InvoicePdfStatus.READY || !invoice.storageKey) {
      return null;
    }

    const existingAuto = await this.prisma.invoiceEmailDelivery.findFirst({
      where: {
        invoiceId,
        isOverride: false,
        status: { in: [InvoiceEmailStatus.SENT, InvoiceEmailStatus.PENDING] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingAuto) {
      if (existingAuto.status === InvoiceEmailStatus.SENT) {
        this.logger.log(
          { invoiceId, deliveryId: existingAuto.id },
          'Automatic invoice email already SENT — skipping duplicate enqueue',
        );
        return existingAuto;
      }

      await this.addDeliveryJobToQueue(invoiceId, existingAuto.id);
      return existingAuto;
    }

    const delivery = await this.prisma.$transaction(async (tx) => {
      const created = await tx.invoiceEmailDelivery.create({
        data: {
          invoiceId: invoice.id,
          recipient: invoice.customerEmail,
          isOverride: false,
          status: InvoiceEmailStatus.PENDING,
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          emailStatus: InvoiceEmailStatus.PENDING,
          emailLastRecipient: invoice.customerEmail,
        },
      });

      return created;
    });

    await this.addDeliveryJobToQueue(invoice.id, delivery.id);
    return delivery;
  }

  /**
   * Admin manual email resend endpoint handler.
   * Requires PDF status `READY`. Allows an optional recipient override without modifying
   * the invoice's original `customerEmail` or address snapshots.
   */
  async enqueueAdminResend(params: {
    invoiceId: string;
    requestedById: string;
    recipientOverride?: string;
  }): Promise<InvoiceEmailDelivery> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: params.invoiceId },
    });

    if (!invoice) {
      throw new InvoiceNotFoundException();
    }

    if (invoice.pdfStatus !== InvoicePdfStatus.READY || !invoice.storageKey) {
      throw new InvoicePdfNotReadyException(
        invoice.pdfStatus,
        'Cannot send invoice email before the PDF has finished generating.',
      );
    }

    const overrideTrimmed = params.recipientOverride?.trim();
    const recipient = overrideTrimmed || invoice.customerEmail;
    const isOverride = Boolean(
      overrideTrimmed && overrideTrimmed.toLowerCase() !== invoice.customerEmail.toLowerCase(),
    );

    const delivery = await this.prisma.$transaction(async (tx) => {
      const created = await tx.invoiceEmailDelivery.create({
        data: {
          invoiceId: invoice.id,
          recipient,
          isOverride,
          requestedById: params.requestedById,
          status: InvoiceEmailStatus.PENDING,
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          emailStatus: InvoiceEmailStatus.PENDING,
          emailLastRecipient: recipient,
        },
      });

      return created;
    });

    await this.addDeliveryJobToQueue(invoice.id, delivery.id);

    this.logger.log(
      {
        invoiceId: invoice.id,
        deliveryId: delivery.id,
        requestedById: params.requestedById,
        isOverride,
      },
      'Enqueued admin invoice email resend',
    );

    return delivery;
  }

  /**
   * Executes a single email delivery job from BullMQ.
   * Fetches the generated PDF buffer from R2 and sends it as an attachment via MailerService.
   */
  async processDeliveryJob(params: {
    invoiceId: string;
    deliveryId: string;
    attemptNumber: number;
    maxAttempts: number;
  }): Promise<void> {
    const delivery = await this.prisma.invoiceEmailDelivery.findUnique({
      where: { id: params.deliveryId },
    });

    if (!delivery) {
      this.logger.warn(
        { deliveryId: params.deliveryId, invoiceId: params.invoiceId },
        'InvoiceEmailDelivery record not found — skipping email job',
      );
      return;
    }

    if (delivery.status === InvoiceEmailStatus.SENT) {
      this.logger.log(
        { deliveryId: delivery.id, invoiceId: delivery.invoiceId },
        'InvoiceEmailDelivery already marked SENT — skipping duplicate send',
      );
      return;
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: delivery.invoiceId },
    });

    if (!invoice || invoice.pdfStatus !== InvoicePdfStatus.READY || !invoice.storageKey) {
      throw new Error(
        `Invoice ${delivery.invoiceId} PDF is not READY (status: ${invoice?.pdfStatus ?? 'MISSING'})`,
      );
    }

    const now = new Date();
    const billing = (invoice.billingAddress ?? {}) as unknown as InvoiceAddressSnapshot;
    const customerName = billing.name || 'Customer';

    try {
      const pdfBuffer = await this.mediaService.getBuffer(invoice.storageKey);

      await this.mailerService.sendInvoiceEmail({
        to: delivery.recipient,
        customerName,
        invoiceNumber: invoice.invoiceNumber,
        issuedDateFormatted: formatInvoiceDateIst(new Date(invoice.issuedAt)),
        grandTotalFormatted: formatInrCurrency(invoice.grandTotal),
        pdfBuffer,
        attachmentFileName: sanitizeInvoicePdfFileName(invoice.invoiceNumber),
      });

      await this.prisma.$transaction([
        this.prisma.invoiceEmailDelivery.update({
          where: { id: delivery.id },
          data: {
            status: InvoiceEmailStatus.SENT,
            attempts: { increment: 1 },
            lastAttemptAt: now,
            sentAt: now,
            lastError: null,
          },
        }),
        this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            emailStatus: InvoiceEmailStatus.SENT,
            emailAttempts: { increment: 1 },
            emailLastAttemptAt: now,
            emailSentAt: now,
            emailLastError: null,
            emailLastRecipient: delivery.recipient,
          },
        }),
      ]);

      this.logger.log(
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          deliveryId: delivery.id,
        },
        'Successfully delivered invoice email with PDF attachment',
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isFinalAttempt = params.attemptNumber >= params.maxAttempts;
      const nextStatus = isFinalAttempt ? InvoiceEmailStatus.FAILED : InvoiceEmailStatus.PENDING;

      await this.prisma.$transaction([
        this.prisma.invoiceEmailDelivery.update({
          where: { id: delivery.id },
          data: {
            status: nextStatus,
            attempts: { increment: 1 },
            lastAttemptAt: now,
            lastError: errorMessage,
          },
        }),
        this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            emailStatus: nextStatus,
            emailAttempts: { increment: 1 },
            emailLastAttemptAt: now,
            emailLastError: errorMessage,
            emailLastRecipient: delivery.recipient,
          },
        }),
      ]);

      this.logger.error(
        {
          invoiceId: invoice.id,
          deliveryId: delivery.id,
          attemptNumber: params.attemptNumber,
          maxAttempts: params.maxAttempts,
          isFinalAttempt,
          err: errorMessage,
        },
        'Invoice email delivery attempt failed',
      );

      throw error;
    }
  }

  private async addDeliveryJobToQueue(invoiceId: string, deliveryId: string): Promise<void> {
    const jobId = buildInvoiceEmailJobId(deliveryId);
    const existingJob = await this.emailQueue.getJob?.(jobId)?.catch(() => null);
    if (existingJob) {
      const state = await existingJob.getState().catch(() => 'unknown');
      if (state === 'failed' || state === 'completed') {
        await existingJob.remove().catch(() => undefined);
      }
    }

    await this.emailQueue.add(
      SEND_INVOICE_EMAIL_JOB,
      { invoiceId, deliveryId },
      {
        jobId,
        attempts: INVOICE_EMAIL_MAX_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: INVOICE_EMAIL_BACKOFF_DELAY_MS,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }
}
