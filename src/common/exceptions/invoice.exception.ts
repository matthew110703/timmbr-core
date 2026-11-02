import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export class InvoiceNotFoundException extends NotFoundException {
  constructor(message = 'Invoice not found.') {
    super({ message, code: 'INVOICE_NOT_FOUND' });
  }
}

export class InvoicePdfNotReadyException extends ConflictException {
  constructor(pdfStatus: string, message = 'Invoice PDF is still being generated.') {
    super({
      message,
      code: 'INVOICE_PDF_NOT_READY',
      details: { pdfStatus },
    });
  }
}

export class InvoicePdfAlreadyInProgressException extends ConflictException {
  constructor(message = 'Invoice PDF generation is already in progress.') {
    super({ message, code: 'INVOICE_PDF_ALREADY_IN_PROGRESS' });
  }
}

export class InvoiceAlreadyVoidedException extends ConflictException {
  constructor(message = 'Invoice has already been voided.') {
    super({ message, code: 'INVOICE_ALREADY_VOIDED' });
  }
}

export class InvoiceInvalidShippingStateException extends UnprocessableEntityException {
  constructor(state?: string | null) {
    super({
      message: state
        ? `Cannot issue invoice: shipping state "${state}" does not map to a valid Indian GST state code.`
        : 'Cannot issue invoice: shipping state is missing on the order shipping address.',
      code: 'INVOICE_INVALID_SHIPPING_STATE',
    });
  }
}

export class InvoiceMissingHsnException extends UnprocessableEntityException {
  constructor(sku: string) {
    super({
      message: `Cannot issue invoice in production mode: HSN code is missing for item SKU "${sku}".`,
      code: 'INVOICE_MISSING_HSN_CODE',
    });
  }
}

export class InvoiceSellerConfigException extends InternalServerErrorException {
  constructor(message = 'Seller GST configuration is incomplete or invalid for invoice issuance.') {
    super({ message, code: 'INVOICE_SELLER_CONFIG_INVALID' });
  }
}

export class InvoiceReconciliationException extends UnprocessableEntityException {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      code: 'INVOICE_RECONCILIATION_FAILED',
      ...(details && { details }),
    });
  }
}

export class InvoiceIneligibleOrderException extends BadRequestException {
  constructor(message: string) {
    super({ message, code: 'INVOICE_ORDER_INELIGIBLE' });
  }
}
