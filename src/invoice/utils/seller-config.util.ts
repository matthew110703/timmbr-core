import { env } from '@/config/env';
import { INDIAN_GSTIN_REGEX, INVOICE_PREFIX_REGEX } from '@/config/env.schema';
import { InvoiceSellerConfigException } from '@/common/exceptions/invoice.exception';
import { resolveGstState } from './gst-place-of-supply.util';

export interface SellerSnapshot {
  legalName: string;
  gstin: string;
  address: string;
  state: string;
  stateCode: string;
  phone: string;
  email: string;
}

export interface ValidatedSellerConfig {
  prefix: string;
  requireHsn: boolean;
  seller: SellerSnapshot;
}

/**
 * Validates and builds the seller configuration snapshot from environment variables.
 * State code and state name are automatically derived from the first 2 digits of the GSTIN.
 */
export function getValidatedSellerConfig(): ValidatedSellerConfig {
  const prefix = (env.INVOICE_NUMBER_PREFIX ?? 'INV').trim().toUpperCase();
  if (!INVOICE_PREFIX_REGEX.test(prefix)) {
    throw new InvoiceSellerConfigException(
      `Invalid INVOICE_NUMBER_PREFIX "${prefix}". Must be 1-3 uppercase alphanumeric characters.`,
    );
  }

  const legalName = env.INVOICE_SELLER_NAME?.trim();
  const gstin = env.INVOICE_SELLER_GSTIN?.trim().toUpperCase();
  const address = env.INVOICE_SELLER_ADDRESS?.trim();
  const phone = env.INVOICE_SELLER_PHONE?.trim();
  const email = env.INVOICE_SELLER_EMAIL?.trim();

  const missing: string[] = [];
  if (!legalName) missing.push('INVOICE_SELLER_NAME');
  if (!gstin) missing.push('INVOICE_SELLER_GSTIN');
  if (!address) missing.push('INVOICE_SELLER_ADDRESS');
  if (!phone) missing.push('INVOICE_SELLER_PHONE');
  if (!email) missing.push('INVOICE_SELLER_EMAIL');

  if (missing.length > 0) {
    throw new InvoiceSellerConfigException(
      `Seller GST configuration is missing required fields: ${missing.join(', ')}.`,
    );
  }

  if (!INDIAN_GSTIN_REGEX.test(gstin!)) {
    throw new InvoiceSellerConfigException(
      `Invalid INVOICE_SELLER_GSTIN "${gstin}". Expected 15-character Indian GSTIN.`,
    );
  }

  const stateCode = gstin!.slice(0, 2);
  const resolvedSellerState = resolveGstState(stateCode);
  if (!resolvedSellerState) {
    throw new InvoiceSellerConfigException(
      `Invalid state code "${stateCode}" in INVOICE_SELLER_GSTIN. Expected a valid 2-digit Indian GST state code (01-38).`,
    );
  }

  const state = resolvedSellerState.name;

  const requireHsn =
    env.INVOICE_REQUIRE_HSN !== undefined
      ? env.INVOICE_REQUIRE_HSN === 'true'
      : env.NODE_ENV === 'prod';

  return {
    prefix,
    requireHsn,
    seller: {
      legalName: legalName!,
      gstin: gstin!,
      address: address!,
      state,
      stateCode,
      phone: phone!,
      email: email!,
    },
  };
}
