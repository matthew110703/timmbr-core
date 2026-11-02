import { InvoiceStatus, Prisma, TaxRegime } from '@prisma/client';
import { TIMMBR_BRAND_LOGO_URL } from '@/mailer/templates/constants';
import { InvoiceWithItems } from '../invoice.repository';
import { InvoiceAddressSnapshot, InvoicePaymentSnapshot } from '../invoice-issuance.service';
import { SellerSnapshot } from '../utils/seller-config.util';
import { IST_OFFSET_MS } from '../utils/invoice-number.util';
import { INVOICE_LABELS_EN, InvoiceTemplateLabels } from './invoice-labels.en';

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function escapeHtml(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats a Prisma.Decimal (or numeric string/number) using the Indian numbering system (`en-IN`)
 * prefixed with `₹`. Keeps `.XX` decimals when paise are non-zero, or whole rupees when `.00`.
 */
export function formatInrCurrency(value: Prisma.Decimal | number | string): string {
  const dec = new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const fixed = dec.toFixed(2);
  const [intPartRaw, fracPart] = fixed.split('.');
  const isNegative = intPartRaw.startsWith('-');
  const digits = isNegative ? intPartRaw.slice(1) : intPartRaw;

  let formattedInt = digits;
  if (digits.length > 3) {
    const lastThree = digits.slice(-3);
    const otherNumbers = digits.slice(0, -3);
    const grouped = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedInt = `${grouped},${lastThree}`;
  }

  const sign = isNegative ? '-' : '';
  if (fracPart === '00') {
    return `${sign}₹${formattedInt}`;
  }
  return `${sign}₹${formattedInt}.${fracPart}`;
}

/**
 * Formats an issuance date in IST as `DD Month, YYYY` (matching `02 June, 2030` in the reference PDF).
 */
export function formatInvoiceDateIst(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const day = String(ist.getUTCDate()).padStart(2, '0');
  const month = MONTHS_EN[ist.getUTCMonth()] ?? '';
  const year = ist.getUTCFullYear();
  return `${day} ${month}, ${year}`;
}

/**
 * Computes the display discount percentage for an invoice item (`0%`, `10%`, etc.).
 */
export function formatItemDiscountPercentage(
  grossAmount: Prisma.Decimal | number | string,
  productDiscount: Prisma.Decimal | number | string,
): string {
  const gross = new Prisma.Decimal(grossAmount);
  const disc = new Prisma.Decimal(productDiscount);
  if (gross.lte(0) || disc.lte(0)) {
    return '0%';
  }
  const pct = disc.mul(100).div(gross).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const fixed = pct.toFixed(2);
  return fixed.endsWith('.00') ? `${fixed.slice(0, -3)}%` : `${fixed}%`;
}

export interface InvoiceTemplateAssets {
  logoDataUri?: string;
  fontCss?: string;
}

export interface RenderInvoiceHtmlOptions {
  invoice: InvoiceWithItems;
  assets?: InvoiceTemplateAssets;
  labels?: InvoiceTemplateLabels;
}

/**
 * Renders the HTML document for the Timmbr Invoice (`templateVersion = 'v1'`).
 * Reproduces the visual layout, typography, colors, and structure of `Timmbr Invoice.pdf`.
 */
export function renderInvoiceHtmlV1(options: RenderInvoiceHtmlOptions): string {
  const { invoice } = options;
  const assets = options.assets ?? {};
  const logoSrc = assets.logoDataUri || TIMMBR_BRAND_LOGO_URL;
  const labels = options.labels ?? INVOICE_LABELS_EN;

  const seller = (invoice.sellerSnapshot ?? {}) as unknown as SellerSnapshot;
  const billing = (invoice.billingAddress ?? {}) as unknown as InvoiceAddressSnapshot;
  const payment = (invoice.paymentSnapshot ?? {}) as unknown as InvoicePaymentSnapshot;

  const formattedDate = formatInvoiceDateIst(new Date(invoice.issuedAt));
  const isVoid = invoice.status === InvoiceStatus.VOID;

  const billingLines = [
    billing.line1,
    billing.line2,
    [billing.city, billing.state, billing.postalCode].filter(Boolean).join(', '),
  ].filter(Boolean);

  const sellerAddressText = seller.address || '';

  const rowsHtml = invoice.items
    .map((item) => {
      const discountLabel = formatItemDiscountPercentage(item.grossAmount, item.productDiscount);
      const amountLabel = formatInrCurrency(item.taxableAmount);
      return `
        <tr class="item-row">
          <td class="col-item">
            <div class="item-title">${escapeHtml(item.title)}</div>
          </td>
          <td class="col-hsn">${escapeHtml(item.hsnCode || '—')}</td>
          <td class="col-qty">${escapeHtml(item.quantity)}</td>
          <td class="col-discount">${escapeHtml(discountLabel)}</td>
          <td class="col-amount">${escapeHtml(amountLabel)}</td>
        </tr>`;
    })
    .join('\n');

  const shippingFeeDec = new Prisma.Decimal(invoice.shippingFee);
  const shippingRowHtml = shippingFeeDec.gt(0)
    ? `
      <div class="summary-row">
        <div class="summary-label">${escapeHtml(labels.shippingLabel)}</div>
        <div class="summary-value">${escapeHtml(formatInrCurrency(invoice.shippingFee))}</div>
      </div>`
    : '';

  const taxRowsHtml =
    invoice.taxRegime === TaxRegime.INTRA_STATE
      ? `
      <div class="summary-row">
        <div class="summary-label">${escapeHtml(labels.cgstLabel)}</div>
        <div class="summary-value">${escapeHtml(formatInrCurrency(invoice.cgstTotal))}</div>
      </div>
      <div class="summary-row">
        <div class="summary-label">${escapeHtml(labels.sgstLabel)}</div>
        <div class="summary-value">${escapeHtml(formatInrCurrency(invoice.sgstTotal))}</div>
      </div>`
      : `
      <div class="summary-row">
        <div class="summary-label">${escapeHtml(labels.igstLabel)}</div>
        <div class="summary-value">${escapeHtml(formatInrCurrency(invoice.igstTotal))}</div>
      </div>`;

  const contactLine = [seller.legalName, seller.phone, seller.email].filter(Boolean).join(', ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    ${assets.fontCss ?? ''}

    @page {
      size: A4 portrait;
      margin: 18mm 18mm 20mm 18mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Poppins', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      color: #1F1F1F;
      background-color: #FFFFFF;
      font-size: 13px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .invoice-container {
      width: 100%;
      position: relative;
    }

    .void-watermark {
      position: fixed;
      top: 42%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-32deg);
      font-size: 110px;
      font-weight: 800;
      color: rgba(211, 47, 47, 0.12);
      border: 8px solid rgba(211, 47, 47, 0.12);
      padding: 8px 36px;
      border-radius: 12px;
      pointer-events: none;
      z-index: 999;
      letter-spacing: 8px;
    }

    /* Top Header */
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
    }

    .brand-logo img {
      height: 46px;
      width: auto;
      display: block;
    }

    .invoice-meta {
      text-align: right;
      font-size: 14px;
      color: #2B2B2B;
      line-height: 1.6;
    }

    /* Large INVOICE Title & Date */
    .title-block {
      margin-bottom: 30px;
    }

    .invoice-title {
      font-size: 46px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #1E1E1E;
      line-height: 1.1;
      margin-bottom: 12px;
    }

    .invoice-date {
      font-size: 14px;
      color: #2B2B2B;
    }

    .invoice-date strong {
      font-weight: 700;
      margin-right: 8px;
    }

    /* Billed To & From Columns */
    .parties-grid {
      display: flex;
      justify-content: space-between;
      gap: 40px;
      margin-bottom: 34px;
    }

    .party-col {
      flex: 1;
      font-size: 13.5px;
      color: #2B2B2B;
      line-height: 1.55;
    }

    .party-heading {
      font-size: 15px;
      font-weight: 700;
      color: #1E1E1E;
      margin-bottom: 6px;
    }

    .party-name-bold {
      font-weight: 700;
      color: #1E1E1E;
    }

    .place-of-supply {
      margin-top: 4px;
      font-size: 12px;
      color: #4A4A4A;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }

    .items-table thead {
      display: table-header-group;
    }

    .items-table thead tr {
      background-color: #E5E5E5;
    }

    .items-table th {
      font-size: 13px;
      font-weight: 600;
      color: #2B2B2B;
      padding: 12px 14px;
      text-align: center;
    }

    .items-table th.col-item {
      text-align: left;
      width: 36%;
    }

    .items-table th.col-hsn {
      width: 18%;
    }

    .items-table th.col-qty {
      width: 14%;
    }

    .items-table th.col-discount {
      width: 14%;
    }

    .items-table th.col-amount {
      text-align: right;
      width: 18%;
    }

    .items-table tbody tr.item-row {
      border-bottom: 1px solid #F2F2F2;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .items-table td {
      padding: 13px 14px;
      font-size: 13px;
      color: #2B2B2B;
      text-align: center;
      vertical-align: top;
    }

    .items-table td.col-item {
      text-align: left;
      word-break: break-word;
    }

    .items-table td.col-amount {
      text-align: right;
      white-space: nowrap;
    }

    /* Summary & Totals Section */
    .summary-wrapper {
      border-top: 1.5px solid #D9D9D9;
      padding-top: 6px;
      margin-bottom: 24px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .summary-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 9px 14px;
      border-bottom: 1px solid #F2F2F2;
      font-size: 13.5px;
      color: #2B2B2B;
    }

    .summary-label {
      width: 140px;
      text-align: right;
      padding-right: 28px;
      font-weight: 500;
    }

    .summary-value {
      width: 140px;
      text-align: right;
      white-space: nowrap;
    }

    .summary-total-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 12px 14px;
      border-top: 1.5px solid #D9D9D9;
      font-size: 15px;
      font-weight: 700;
      color: #1E1E1E;
    }

    /* Payment Info */
    .payment-block {
      margin-top: 18px;
      margin-bottom: 48px;
      font-size: 13.5px;
      color: #2B2B2B;
      line-height: 1.65;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .payment-block strong {
      font-weight: 700;
      color: #1E1E1E;
    }

    /* Footer */
    .footer-block {
      margin-top: 40px;
      text-align: center;
      font-size: 13.5px;
      color: #2B2B2B;
      line-height: 1.65;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .footer-thanks {
      font-size: 15px;
      font-weight: 700;
      color: #1E1E1E;
      margin-bottom: 10px;
    }

    .footer-contact-bold {
      font-weight: 700;
      color: #1E1E1E;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    ${isVoid ? `<div class="void-watermark">${escapeHtml(labels.voidWatermark)}</div>` : ''}

    <div class="top-header">
      <div class="brand-logo">
        <img src="${logoSrc}" alt="timmbr" />
      </div>
      <div class="invoice-meta">
        <div>${escapeHtml(labels.invoiceNoPrefix)} ${escapeHtml(invoice.invoiceNumber)}</div>
        <div>${escapeHtml(labels.customerIdPrefix)} ${escapeHtml(invoice.customerCode)}</div>
      </div>
    </div>

    <div class="title-block">
      <h1 class="invoice-title">${escapeHtml(labels.invoiceHeading)}</h1>
      <div class="invoice-date">
        <strong>${escapeHtml(labels.dateLabel)}</strong> ${escapeHtml(formattedDate)}
      </div>
    </div>

    <div class="parties-grid">
      <div class="party-col">
        <div class="party-heading">${escapeHtml(labels.billedToLabel)}</div>
        <div>${escapeHtml(billing.name)}</div>
        ${billingLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('\n        ')}
        ${billing.phone ? `<div>${escapeHtml(billing.phone)}</div>` : ''}
        ${billing.email ? `<div>${escapeHtml(billing.email)}</div>` : ''}
        <div class="place-of-supply">
          ${escapeHtml(labels.placeOfSupplyPrefix)} ${escapeHtml(invoice.placeOfSupplyState)} (${escapeHtml(invoice.placeOfSupplyCode)})
        </div>
      </div>

      <div class="party-col">
        <div class="party-heading">${escapeHtml(labels.fromLabel)}</div>
        <div class="party-name-bold">${escapeHtml(seller.legalName)}</div>
        ${sellerAddressText ? `<div>${escapeHtml(sellerAddressText)}</div>` : ''}
        ${seller.phone ? `<div>${escapeHtml(seller.phone)}</div>` : ''}
        <div>${escapeHtml(labels.gstinPrefix)} ${escapeHtml(invoice.sellerGstin)}</div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th class="col-item">${escapeHtml(labels.columnItem)}</th>
          <th class="col-hsn">${escapeHtml(labels.columnHsn)}</th>
          <th class="col-qty">${escapeHtml(labels.columnQuantity)}</th>
          <th class="col-discount">${escapeHtml(labels.columnDiscount)}</th>
          <th class="col-amount">${escapeHtml(labels.columnAmount)}</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="summary-wrapper">
      ${shippingRowHtml}
      ${taxRowsHtml}
      <div class="summary-total-row">
        <div class="summary-label">${escapeHtml(labels.totalLabel)}</div>
        <div class="summary-value">${escapeHtml(formatInrCurrency(invoice.grandTotal))}</div>
      </div>
    </div>

    <div class="payment-block">
      <div>
        <strong>${escapeHtml(labels.paymentMethodLabel)}</strong> ${escapeHtml(payment.methodLabel || 'Online')}
      </div>
      <div>${escapeHtml(payment.description || '')}</div>
    </div>

    <div class="footer-block">
      <div class="footer-thanks">${escapeHtml(labels.thankYouMessage)}</div>
      <div>${escapeHtml(labels.contactPrompt)}</div>
      <div class="footer-contact-bold">${escapeHtml(contactLine)}</div>
    </div>
  </div>
</body>
</html>`;
}
