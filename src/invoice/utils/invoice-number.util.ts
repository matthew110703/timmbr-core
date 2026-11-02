import { BadRequestException } from '@nestjs/common';

export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const GST_RULE_46_INVOICE_NUMBER_REGEX = /^[A-Z0-9/-]{1,16}$/;
const PREFIX_REGEX = /^[A-Z0-9]{1,3}$/;

/**
 * Determines the Indian Financial Year in `YY-YY` format (e.g. `26-27`)
 * using the actual invoice issuance timestamp in `Asia/Kolkata` (IST, UTC+05:30).
 * Financial year runs from April 1 to March 31.
 */
export function getIndianFinancialYearShort(issuedAt: Date): string {
  const istTime = new Date(issuedAt.getTime() + IST_OFFSET_MS);
  const year = istTime.getUTCFullYear();
  const monthZeroIndexed = istTime.getUTCMonth(); // 0 = Jan, 2 = Mar, 3 = Apr

  const startYear = monthZeroIndexed >= 3 ? year : year - 1;
  const endYear = startYear + 1;

  const yyStart = String(startYear % 100).padStart(2, '0');
  const yyEnd = String(endYear % 100).padStart(2, '0');
  return `${yyStart}-${yyEnd}`;
}

/**
 * Builds the sequence series key for a given seller GSTIN, prefix, and financial year.
 */
export function buildInvoiceSequenceSeries(
  sellerGstin: string,
  prefix: string,
  financialYear: string,
): string {
  return `${sellerGstin}:${prefix}/${financialYear}`;
}

/**
 * Formats a GST Rule 46(b) compliant invoice number: `PREFIX/YY-YY/000001`.
 * Maximum length: 16 characters.
 */
export function formatGstInvoiceNumber(
  prefix: string,
  financialYear: string,
  sequenceValue: number,
): string {
  const normalizedPrefix = prefix.trim().toUpperCase();
  if (!PREFIX_REGEX.test(normalizedPrefix)) {
    throw new BadRequestException(
      `Invalid invoice prefix "${prefix}". Must be 1-3 uppercase alphanumeric characters.`,
    );
  }

  if (!/^[0-9]{2}-[0-9]{2}$/.test(financialYear)) {
    throw new BadRequestException(
      `Invalid financial year "${financialYear}". Expected YY-YY format.`,
    );
  }

  if (!Number.isInteger(sequenceValue) || sequenceValue < 1 || sequenceValue > 999_999) {
    throw new BadRequestException(
      `Invoice sequence value ${sequenceValue} is out of bounds (1..999999) for 16-char GST limit.`,
    );
  }

  const paddedSeq = String(sequenceValue).padStart(6, '0');
  const invoiceNumber = `${normalizedPrefix}/${financialYear}/${paddedSeq}`;

  if (invoiceNumber.length > 16 || !GST_RULE_46_INVOICE_NUMBER_REGEX.test(invoiceNumber)) {
    throw new BadRequestException(
      `Generated invoice number "${invoiceNumber}" violates GST Rule 46 (max 16 chars).`,
    );
  }

  return invoiceNumber;
}

/**
 * Generates a deterministic 6-character uppercase alphanumeric customer reference code from userId.
 */
export function formatCustomerCode(userId: string): string {
  const clean = userId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return clean.slice(0, 6).padEnd(6, '0');
}

/**
 * Produces a safe PDF attachment/download filename from a GST invoice number (e.g. `INV_26-27_000001.pdf`).
 */
export function sanitizeInvoicePdfFileName(invoiceNumber: string): string {
  return `${invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
}
