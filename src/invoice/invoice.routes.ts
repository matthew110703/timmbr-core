import { APP_ROUTES } from '@/app.routes';

export const INVOICE_ROUTES = {
  CUSTOMER_ORDER_INVOICE: APP_ROUTES.ORDERS,
  INVOICE_BY_ORDER: ':orderId/invoice',
  INVOICE_DOWNLOAD_BY_ORDER: ':orderId/invoice/download',

  ADMIN_INVOICES: `${APP_ROUTES.PREFIX.ADMIN}/${APP_ROUTES.INVOICES}`,
  BY_ID: ':invoiceId',
  DOWNLOAD: ':invoiceId/download',
  RETRY_PDF: ':invoiceId/retry-pdf',
  RESEND_EMAIL: ':invoiceId/resend-email',
  VOID: ':invoiceId/void',
} as const;
