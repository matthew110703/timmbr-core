import { Invoice, InvoiceEmailDelivery, InvoiceItem } from '@prisma/client';
import { InvoiceWithItems } from './invoice.repository';
import {
  AdminInvoiceListItemDto,
  InvoiceEmailDeliveryResponseDto,
  InvoiceItemResponseDto,
  InvoiceResponseDto,
} from './dto/invoice-response.dto';

export class InvoiceMapper {
  static toItemResponse(item: InvoiceItem): InvoiceItemResponseDto {
    return {
      id: item.id,
      invoiceId: item.invoiceId,
      orderItemId: item.orderItemId ?? null,
      productId: item.productId ?? null,
      variantId: item.variantId ?? null,
      title: item.title,
      sku: item.sku,
      hsnCode: item.hsnCode ?? null,
      quantity: item.quantity,
      originalUnitPrice: Number(item.originalUnitPrice),
      unitPrice: Number(item.unitPrice),
      grossAmount: Number(item.grossAmount),
      productDiscount: Number(item.productDiscount),
      finalInclusiveAmount: Number(item.finalInclusiveAmount),
      taxableAmount: Number(item.taxableAmount),
      gstRate: Number(item.gstRate),
      cgstRate: Number(item.cgstRate),
      cgstAmount: Number(item.cgstAmount),
      sgstRate: Number(item.sgstRate),
      sgstAmount: Number(item.sgstAmount),
      igstRate: Number(item.igstRate),
      igstAmount: Number(item.igstAmount),
      totalTax: Number(item.totalTax),
      lineTotal: Number(item.lineTotal),
      createdAt: item.createdAt,
    };
  }

  static toEmailDeliveryResponse(delivery: InvoiceEmailDelivery): InvoiceEmailDeliveryResponseDto {
    return {
      id: delivery.id,
      invoiceId: delivery.invoiceId,
      recipient: delivery.recipient,
      isOverride: delivery.isOverride,
      requestedById: delivery.requestedById ?? null,
      status: delivery.status,
      attempts: delivery.attempts,
      lastError: delivery.lastError ?? null,
      lastAttemptAt: delivery.lastAttemptAt ?? null,
      sentAt: delivery.sentAt ?? null,
      createdAt: delivery.createdAt,
    };
  }

  static toResponse(invoice: InvoiceWithItems): InvoiceResponseDto {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      financialYear: invoice.financialYear,
      templateVersion: invoice.templateVersion,
      orderId: invoice.orderId,
      userId: invoice.userId,
      status: invoice.status,
      pdfStatus: invoice.pdfStatus,
      emailStatus: invoice.emailStatus,
      taxRegime: invoice.taxRegime,
      sellerGstin: invoice.sellerGstin,
      sellerState: invoice.sellerState,
      sellerStateCode: invoice.sellerStateCode,
      placeOfSupplyState: invoice.placeOfSupplyState,
      placeOfSupplyCode: invoice.placeOfSupplyCode,
      currency: invoice.currency,
      subtotalGross: Number(invoice.subtotalGross),
      productDiscountTotal: Number(invoice.productDiscountTotal),
      subtotalDiscounted: Number(invoice.subtotalDiscounted),
      subtotalTaxable: Number(invoice.subtotalTaxable),
      shippingFee: Number(invoice.shippingFee),
      shippingTaxable: Number(invoice.shippingTaxable),
      shippingTax: Number(invoice.shippingTax),
      cgstTotal: Number(invoice.cgstTotal),
      sgstTotal: Number(invoice.sgstTotal),
      igstTotal: Number(invoice.igstTotal),
      taxTotal: Number(invoice.taxTotal),
      grandTotal: Number(invoice.grandTotal),
      customerCode: invoice.customerCode,
      customerEmail: invoice.customerEmail,
      sellerSnapshot: (invoice.sellerSnapshot ?? {}) as Record<string, unknown>,
      billingAddress: (invoice.billingAddress ?? {}) as Record<string, unknown>,
      shippingAddress: (invoice.shippingAddress ?? {}) as Record<string, unknown>,
      paymentSnapshot: (invoice.paymentSnapshot ?? {}) as Record<string, unknown>,
      issuedAt: invoice.issuedAt,
      pdfGenerationVersion: invoice.pdfGenerationVersion,
      pdfGeneratedAt: invoice.pdfGeneratedAt ?? null,
      pdfAttempts: invoice.pdfAttempts,
      pdfLastError: invoice.pdfLastError ?? null,
      emailAttempts: invoice.emailAttempts,
      emailLastError: invoice.emailLastError ?? null,
      emailLastAttemptAt: invoice.emailLastAttemptAt ?? null,
      emailSentAt: invoice.emailSentAt ?? null,
      emailLastRecipient: invoice.emailLastRecipient ?? null,
      voidedAt: invoice.voidedAt ?? null,
      voidedById: invoice.voidedById ?? null,
      voidReason: invoice.voidReason ?? null,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      items: (invoice.items || []).map((item) => InvoiceMapper.toItemResponse(item)),
      ...(invoice.emailDeliveries && {
        emailDeliveries: invoice.emailDeliveries.map((d) =>
          InvoiceMapper.toEmailDeliveryResponse(d),
        ),
      }),
    };
  }

  static toAdminListItem(invoice: Invoice): AdminInvoiceListItemDto {
    const billing = (invoice.billingAddress ?? {}) as Record<string, unknown>;
    const customerName =
      typeof billing.name === 'string' && billing.name.trim() !== ''
        ? billing.name.trim()
        : 'Customer';

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      financialYear: invoice.financialYear,
      orderId: invoice.orderId,
      userId: invoice.userId,
      status: invoice.status,
      pdfStatus: invoice.pdfStatus,
      emailStatus: invoice.emailStatus,
      taxRegime: invoice.taxRegime,
      currency: invoice.currency,
      grandTotal: Number(invoice.grandTotal),
      customerName,
      customerEmail: invoice.customerEmail,
      issuedAt: invoice.issuedAt,
      pdfGeneratedAt: invoice.pdfGeneratedAt ?? null,
      voidedAt: invoice.voidedAt ?? null,
    };
  }
}
