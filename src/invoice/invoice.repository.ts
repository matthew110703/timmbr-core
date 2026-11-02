import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  Invoice,
  InvoiceEmailDelivery,
  InvoiceItem,
  InvoicePdfStatus,
  InvoiceStatus,
  Prisma,
} from '@prisma/client';

export type InvoiceWithItems = Invoice & {
  items: InvoiceItem[];
  emailDeliveries?: InvoiceEmailDelivery[];
};

/**
 * Data access layer for Invoice records.
 * Intentionally exposes NO delete methods: issued invoices and their items are immutable.
 */
@Injectable()
export class InvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<InvoiceWithItems | null> {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        emailDeliveries: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
  }

  async findByOrderId(orderId: string): Promise<InvoiceWithItems | null> {
    return this.prisma.invoice.findUnique({
      where: { orderId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        emailDeliveries: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
  }

  async findAdminInvoices(
    where: Prisma.InvoiceWhereInput,
    page = 1,
    limit = 20,
  ): Promise<[Invoice[], number]> {
    return this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { issuedAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);
  }

  /**
   * Conditional update of PDF status and metadata only if `pdfGenerationVersion` still matches `expectedVersion`.
   * Prevents stale workers from overwriting newer generation versions.
   */
  async updatePdfStateForVersion(
    invoiceId: string,
    expectedVersion: number,
    data: {
      pdfStatus: InvoicePdfStatus;
      storageKey?: string | null;
      pdfGeneratedAt?: Date | null;
      pdfLastError?: string | null;
      incrementAttempts?: boolean;
    },
  ): Promise<number> {
    const result = await this.prisma.invoice.updateMany({
      where: {
        id: invoiceId,
        pdfGenerationVersion: expectedVersion,
      },
      data: {
        pdfStatus: data.pdfStatus,
        ...(data.storageKey !== undefined && { storageKey: data.storageKey }),
        ...(data.pdfGeneratedAt !== undefined && { pdfGeneratedAt: data.pdfGeneratedAt }),
        ...(data.pdfLastError !== undefined && { pdfLastError: data.pdfLastError }),
        ...(data.incrementAttempts && { pdfAttempts: { increment: 1 } }),
      },
    });
    return result.count;
  }

  async voidInvoice(params: {
    invoiceId: string;
    voidedById: string;
    voidReason: string;
    voidedAt?: Date;
  }): Promise<InvoiceWithItems | null> {
    const voidedAt = params.voidedAt ?? new Date();
    const updated = await this.prisma.invoice.updateMany({
      where: {
        id: params.invoiceId,
        status: InvoiceStatus.ISSUED,
      },
      data: {
        status: InvoiceStatus.VOID,
        voidedAt,
        voidedById: params.voidedById,
        voidReason: params.voidReason,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return this.findById(params.invoiceId);
  }
}
