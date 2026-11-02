import { InvoiceEmailStatus, InvoicePdfStatus, InvoiceStatus, TaxRegime } from '@prisma/client';

export class InvoiceItemResponseDto {
  id!: string;
  invoiceId!: string;
  orderItemId!: string | null;
  productId!: string | null;
  variantId!: string | null;
  title!: string;
  sku!: string;
  hsnCode!: string | null;
  quantity!: number;
  originalUnitPrice!: number;
  unitPrice!: number;
  grossAmount!: number;
  productDiscount!: number;
  finalInclusiveAmount!: number;
  taxableAmount!: number;
  gstRate!: number;
  cgstRate!: number;
  cgstAmount!: number;
  sgstRate!: number;
  sgstAmount!: number;
  igstRate!: number;
  igstAmount!: number;
  totalTax!: number;
  lineTotal!: number;
  createdAt!: Date;
}

export class InvoiceEmailDeliveryResponseDto {
  id!: string;
  invoiceId!: string;
  recipient!: string;
  isOverride!: boolean;
  requestedById!: string | null;
  status!: InvoiceEmailStatus;
  attempts!: number;
  lastError!: string | null;
  lastAttemptAt!: Date | null;
  sentAt!: Date | null;
  createdAt!: Date;
}

export class InvoiceResponseDto {
  id!: string;
  invoiceNumber!: string;
  financialYear!: string;
  templateVersion!: string;
  orderId!: string;
  userId!: string;
  status!: InvoiceStatus;
  pdfStatus!: InvoicePdfStatus;
  emailStatus!: InvoiceEmailStatus;
  taxRegime!: TaxRegime;
  sellerGstin!: string;
  sellerState!: string;
  sellerStateCode!: string;
  placeOfSupplyState!: string;
  placeOfSupplyCode!: string;
  currency!: string;
  subtotalGross!: number;
  productDiscountTotal!: number;
  subtotalDiscounted!: number;
  subtotalTaxable!: number;
  shippingFee!: number;
  shippingTaxable!: number;
  shippingTax!: number;
  cgstTotal!: number;
  sgstTotal!: number;
  igstTotal!: number;
  taxTotal!: number;
  grandTotal!: number;
  customerCode!: string;
  customerEmail!: string;
  sellerSnapshot!: Record<string, unknown>;
  billingAddress!: Record<string, unknown>;
  shippingAddress!: Record<string, unknown>;
  paymentSnapshot!: Record<string, unknown>;
  issuedAt!: Date;
  pdfGenerationVersion!: number;
  pdfGeneratedAt!: Date | null;
  pdfAttempts!: number;
  pdfLastError!: string | null;
  emailAttempts!: number;
  emailLastError!: string | null;
  emailLastAttemptAt!: Date | null;
  emailSentAt!: Date | null;
  emailLastRecipient!: string | null;
  voidedAt!: Date | null;
  voidedById!: string | null;
  voidReason!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  items!: InvoiceItemResponseDto[];
  emailDeliveries?: InvoiceEmailDeliveryResponseDto[];
}

export class AdminInvoiceListItemDto {
  id!: string;
  invoiceNumber!: string;
  financialYear!: string;
  orderId!: string;
  userId!: string;
  status!: InvoiceStatus;
  pdfStatus!: InvoicePdfStatus;
  emailStatus!: InvoiceEmailStatus;
  taxRegime!: TaxRegime;
  currency!: string;
  grandTotal!: number;
  customerName!: string;
  customerEmail!: string;
  issuedAt!: Date;
  pdfGeneratedAt!: Date | null;
  voidedAt!: Date | null;
}

export class InvoiceDownloadResponseDto {
  downloadUrl!: string;
  fileName!: string;
  expiresIn!: number;
}
