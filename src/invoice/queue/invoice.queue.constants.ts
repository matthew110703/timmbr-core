export const INVOICE_PDF_QUEUE = 'invoice-pdf';
export const INVOICE_EMAIL_QUEUE = 'invoice-email';

export const GENERATE_INVOICE_PDF_JOB = 'generate-invoice-pdf';
export const SEND_INVOICE_EMAIL_JOB = 'send-invoice-email';

export const OUTBOX_AGGREGATE_INVOICE = 'INVOICE';
export const OUTBOX_EVENT_INVOICE_PDF_GENERATE = 'INVOICE_PDF_GENERATE';

export const INVOICE_TEMPLATE_VERSION_V1 = 'v1';

export interface InvoicePdfJobPayload {
  invoiceId: string;
  version: number;
  force?: boolean;
}

export interface InvoiceEmailJobPayload {
  invoiceId: string;
  deliveryId: string;
}

/**
 * Deterministic BullMQ job ID per invoice and generation version.
 * Using `v${version}` ensures admin retries enqueue a fresh job without colliding with prior versions.
 */
export function buildInvoicePdfJobId(invoiceId: string, version: number): string {
  return `invoice-pdf-${invoiceId}-v${version}`;
}

/**
 * Deterministic BullMQ job ID per email delivery record.
 */
export function buildInvoiceEmailJobId(deliveryId: string): string {
  return `invoice-email-${deliveryId}`;
}

/**
 * Versioned private R2 object key during PDF generation.
 */
export function buildInvoiceVersionStorageKey(invoiceId: string, version: number): string {
  return `invoices/${invoiceId}/versions/${version}/invoice.pdf`;
}
