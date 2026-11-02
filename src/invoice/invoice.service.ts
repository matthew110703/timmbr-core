import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { MediaService } from '@/media/media.service';
import { env } from '@/config/env';
import { PaginatedResult } from '@/common/types/api-response.types';
import {
  InvoiceAlreadyVoidedException,
  InvoiceNotFoundException,
  InvoicePdfAlreadyInProgressException,
  InvoicePdfNotReadyException,
} from '@/common/exceptions/invoice.exception';
import {
  OrderAccessForbiddenException,
  OrderNotFoundException,
} from '@/common/exceptions/order.exception';
import { InvoicePdfStatus, InvoiceStatus, OutboxEventStatus, Prisma } from '@prisma/client';
import { InvoiceRepository } from './invoice.repository';
import { InvoiceMapper } from './invoice.mapper';
import {
  AdminInvoiceListItemDto,
  InvoiceDownloadResponseDto,
  InvoiceEmailDeliveryResponseDto,
  InvoiceResponseDto,
} from './dto/invoice-response.dto';
import { GetInvoicesQueryDto } from './dto/get-invoices-query.dto';
import { VoidInvoiceDto } from './dto/void-invoice.dto';
import { ResendInvoiceEmailDto } from './dto/resend-invoice-email.dto';
import { InvoiceEmailService } from './email/invoice-email.service';
import {
  buildInvoicePdfJobId,
  INVOICE_PDF_QUEUE,
  InvoicePdfJobPayload,
  OUTBOX_AGGREGATE_INVOICE,
  OUTBOX_EVENT_INVOICE_PDF_GENERATE,
} from './queue/invoice.queue.constants';
import { sanitizeInvoicePdfFileName } from './utils/invoice-number.util';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly mediaService: MediaService,
    private readonly invoiceEmailService: InvoiceEmailService,
    @InjectQueue(INVOICE_PDF_QUEUE)
    private readonly pdfQueue: Queue<InvoicePdfJobPayload>,
  ) {}

  /**
   * Customer endpoint: `GET /api/v1/orders/:orderId/invoice`
   * Verifies order existence and customer ownership before returning invoice details.
   */
  async getCustomerInvoiceByOrderId(userId: string, orderId: string): Promise<InvoiceResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });

    if (!order) {
      throw new OrderNotFoundException();
    }

    if (order.userId !== userId) {
      throw new OrderAccessForbiddenException();
    }

    const invoice = await this.invoiceRepository.findByOrderId(orderId);
    if (!invoice) {
      throw new InvoiceNotFoundException('No invoice has been issued for this order yet.');
    }

    return InvoiceMapper.toResponse(invoice);
  }

  /**
   * Customer endpoint: `GET /api/v1/orders/:orderId/invoice/download`
   * Verifies ownership, requires `pdfStatus === READY`, and returns a short-lived R2 signed GET URL.
   * Never triggers PDF regeneration merely because a customer accesses the endpoint.
   */
  async getCustomerInvoiceDownloadUrl(
    userId: string,
    orderId: string,
  ): Promise<InvoiceDownloadResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });

    if (!order) {
      throw new OrderNotFoundException();
    }

    if (order.userId !== userId) {
      throw new OrderAccessForbiddenException();
    }

    const invoice = await this.invoiceRepository.findByOrderId(orderId);
    if (!invoice) {
      throw new InvoiceNotFoundException('No invoice has been issued for this order yet.');
    }

    return this.buildDownloadResponse(invoice.invoiceNumber, invoice.pdfStatus, invoice.storageKey);
  }

  /**
   * Admin endpoint: `GET /api/v1/admin/invoices`
   */
  async getAdminInvoices(
    query: GetInvoicesQueryDto,
  ): Promise<PaginatedResult<AdminInvoiceListItemDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const issuedAtFilter: Prisma.DateTimeFilter = {};
    if (query.from) {
      issuedAtFilter.gte = new Date(query.from);
    }
    if (query.to) {
      const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(query.to.trim());
      issuedAtFilter.lte = isDateOnly
        ? new Date(`${query.to.trim()}T23:59:59.999Z`)
        : new Date(query.to);
    }

    const where: Prisma.InvoiceWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.pdfStatus && { pdfStatus: query.pdfStatus }),
      ...(query.orderId && { orderId: query.orderId }),
      ...(query.financialYear && { financialYear: query.financialYear }),
      ...((query.from || query.to) && { issuedAt: issuedAtFilter }),
      ...(query.search && {
        OR: [
          { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
          { customerEmail: { contains: query.search, mode: 'insensitive' } },
          {
            billingAddress: {
              path: ['name'],
              string_contains: query.search,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const [invoices, total] = await this.invoiceRepository.findAdminInvoices(where, page, limit);
    const totalPages = Math.ceil(total / limit);

    return {
      data: invoices.map((inv) => InvoiceMapper.toAdminListItem(inv)),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Admin endpoint: `GET /api/v1/admin/invoices/:invoiceId`
   */
  async getAdminInvoiceById(invoiceId: string): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) {
      throw new InvoiceNotFoundException();
    }
    return InvoiceMapper.toResponse(invoice);
  }

  /**
   * Admin endpoint: `GET /api/v1/admin/invoices/:invoiceId/download`
   */
  async getAdminInvoiceDownloadUrl(invoiceId: string): Promise<InvoiceDownloadResponseDto> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) {
      throw new InvoiceNotFoundException();
    }

    return this.buildDownloadResponse(invoice.invoiceNumber, invoice.pdfStatus, invoice.storageKey);
  }

  /**
   * Admin endpoint: `POST /api/v1/admin/invoices/:invoiceId/retry-pdf`
   * - Prevents duplicate retries while the current job is active (`PROCESSING` or active in BullMQ).
   * - Atomically increments `pdfGenerationVersion`, resets `pdfStatus` to `PENDING`, clears `pdfLastError`,
   *   and inserts a new transactional `OutboxEvent`.
   * - Never creates a new invoice or invoice number.
   */
  async retryPdfGeneration(invoiceId: string, adminUserId: string): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) {
      throw new InvoiceNotFoundException();
    }

    if (invoice.pdfStatus === InvoicePdfStatus.PROCESSING) {
      throw new InvoicePdfAlreadyInProgressException();
    }

    // Check BullMQ job state for the current version
    const currentJobId = buildInvoicePdfJobId(invoice.id, invoice.pdfGenerationVersion);
    const existingJob = await this.pdfQueue.getJob(currentJobId).catch(() => null);
    if (existingJob) {
      const state = await existingJob.getState().catch(() => 'unknown');
      if (state === 'active' || state === 'waiting' || state === 'delayed') {
        throw new InvoicePdfAlreadyInProgressException(
          `A PDF generation job (${currentJobId}) is already ${state}.`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const guard = await tx.invoice.updateMany({
        where: {
          id: invoice.id,
          pdfGenerationVersion: invoice.pdfGenerationVersion,
          pdfStatus: { not: InvoicePdfStatus.PROCESSING },
        },
        data: {
          pdfGenerationVersion: { increment: 1 },
          pdfStatus: InvoicePdfStatus.PENDING,
          pdfLastError: null,
        },
      });

      if (guard.count === 0) {
        throw new InvoicePdfAlreadyInProgressException();
      }

      const refreshed = await tx.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: {
          items: { orderBy: { createdAt: 'asc' } },
          emailDeliveries: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: OUTBOX_AGGREGATE_INVOICE,
          aggregateId: refreshed.id,
          eventType: OUTBOX_EVENT_INVOICE_PDF_GENERATE,
          payload: {
            invoiceId: refreshed.id,
            version: refreshed.pdfGenerationVersion,
            force: true,
          },
          status: OutboxEventStatus.PENDING,
          nextAttemptAt: new Date(),
        },
      });

      return refreshed;
    });

    this.logger.log(
      {
        invoiceId: updated.id,
        invoiceNumber: updated.invoiceNumber,
        newVersion: updated.pdfGenerationVersion,
        adminUserId,
      },
      'Admin requested invoice PDF regeneration',
    );

    return InvoiceMapper.toResponse(updated);
  }

  /**
   * Admin endpoint: `POST /api/v1/admin/invoices/:invoiceId/resend-email`
   */
  async resendInvoiceEmail(
    invoiceId: string,
    adminUserId: string,
    dto: ResendInvoiceEmailDto,
  ): Promise<InvoiceEmailDeliveryResponseDto> {
    const delivery = await this.invoiceEmailService.enqueueAdminResend({
      invoiceId,
      requestedById: adminUserId,
      recipientOverride: dto.recipient,
    });

    return InvoiceMapper.toEmailDeliveryResponse(delivery);
  }

  /**
   * Super Admin (`UserRole.MASTER`) endpoint: `PATCH /api/v1/admin/invoices/:invoiceId/void`
   * - Records actor ID, timestamp, and mandatory reason (5-500 chars).
   * - Preserves original invoice snapshots, PDF, and invoice number.
   * - Rejects repeated void attempts.
   */
  async voidInvoice(
    invoiceId: string,
    superAdminUserId: string,
    dto: VoidInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    const existing = await this.invoiceRepository.findById(invoiceId);
    if (!existing) {
      throw new InvoiceNotFoundException();
    }

    if (existing.status === InvoiceStatus.VOID) {
      throw new InvoiceAlreadyVoidedException();
    }

    const voided = await this.invoiceRepository.voidInvoice({
      invoiceId,
      voidedById: superAdminUserId,
      voidReason: dto.reason,
    });

    if (!voided) {
      throw new InvoiceAlreadyVoidedException();
    }

    this.logger.warn(
      {
        invoiceId: voided.id,
        invoiceNumber: voided.invoiceNumber,
        orderId: voided.orderId,
        voidedById: superAdminUserId,
        voidReason: dto.reason,
      },
      `Invoice ${voided.invoiceNumber} marked as VOID by Super Admin`,
    );

    return InvoiceMapper.toResponse(voided);
  }

  private async buildDownloadResponse(
    invoiceNumber: string,
    pdfStatus: InvoicePdfStatus,
    storageKey: string | null,
  ): Promise<InvoiceDownloadResponseDto> {
    if (pdfStatus !== InvoicePdfStatus.READY || !storageKey) {
      throw new InvoicePdfNotReadyException(pdfStatus);
    }

    const fileName = sanitizeInvoicePdfFileName(invoiceNumber);
    const ttlSeconds = env.INVOICE_DOWNLOAD_URL_TTL_SECONDS ?? 300;

    const presigned = await this.mediaService.getPresignedDownloadUrl({
      key: storageKey,
      downloadFileName: fileName,
      responseContentType: 'application/pdf',
      expiresInSeconds: ttlSeconds,
    });

    return {
      downloadUrl: presigned.downloadUrl,
      fileName,
      expiresIn: presigned.expiresIn,
    };
  }
}
