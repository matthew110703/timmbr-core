import { InvoicePdfStatus, InvoiceStatus, Prisma, TaxRegime } from '@prisma/client';
import { TIMMBR_BRAND_LOGO_URL } from '@/mailer/templates/constants';
import {
  escapeHtml,
  formatInrCurrency,
  formatInvoiceDateIst,
  renderInvoiceHtmlV1,
} from './invoice-html.template';
import { PdfRendererService } from './pdf-renderer.service';

describe('Invoice HTML Template & PDF Renderer', () => {
  const sampleInvoice: any = {
    id: 'inv-uuid-1',
    invoiceNumber: 'INV/26-27/000001',
    financialYear: '26-27',
    templateVersion: 'v1',
    orderId: 'order-uuid-1',
    userId: 'user-uuid-1',
    status: InvoiceStatus.ISSUED,
    pdfStatus: InvoicePdfStatus.PENDING,
    taxRegime: TaxRegime.INTRA_STATE,
    sellerGstin: '29AABCT1234F1Z5',
    sellerState: 'Karnataka',
    sellerStateCode: '29',
    placeOfSupplyState: 'Karnataka',
    placeOfSupplyCode: '29',
    currency: 'INR',
    subtotalGross: new Prisma.Decimal('147500.00'),
    productDiscountTotal: new Prisma.Decimal('0.00'),
    subtotalDiscounted: new Prisma.Decimal('147500.00'),
    subtotalTaxable: new Prisma.Decimal('125000.00'),
    shippingFee: new Prisma.Decimal('0.00'),
    shippingTaxable: new Prisma.Decimal('0.00'),
    shippingTax: new Prisma.Decimal('0.00'),
    cgstTotal: new Prisma.Decimal('11250.00'),
    sgstTotal: new Prisma.Decimal('11250.00'),
    igstTotal: new Prisma.Decimal('0.00'),
    taxTotal: new Prisma.Decimal('22500.00'),
    grandTotal: new Prisma.Decimal('147500.00'),
    customerCode: 'CUST01',
    customerEmail: 'buyer@example.com',
    sellerSnapshot: {
      legalName: 'Timmbr Test Seller Pvt Ltd',
      gstin: '29AABCT1234F1Z5',
      address: '100 Industrial Layout, Phase 2, Bengaluru, Karnataka - 560001',
      state: 'Karnataka',
      stateCode: '29',
      phone: '+91 8000000000',
      email: 'billing@example.com',
    },
    billingAddress: {
      name: 'Aarav <script>alert(1)</script>',
      email: 'buyer@example.com',
      phone: '+91 9876543210',
      line1: '12 MG Road',
      line2: null,
      city: 'Bengaluru',
      state: 'Karnataka',
      stateCode: '29',
      postalCode: '560038',
      country: 'India',
    },
    shippingAddress: {},
    paymentSnapshot: {
      methodLabel: 'Online (Razorpay)',
      description: 'Ref: pay_rzp_100',
    },
    issuedAt: new Date('2026-06-02T08:00:00.000Z'),
    items: [
      {
        id: 'item-1',
        invoiceId: 'inv-uuid-1',
        title: '2 Seater Sofa',
        sku: 'SOFA-2S',
        hsnCode: '9401',
        quantity: 1,
        originalUnitPrice: new Prisma.Decimal('147500.00'),
        unitPrice: new Prisma.Decimal('147500.00'),
        grossAmount: new Prisma.Decimal('147500.00'),
        productDiscount: new Prisma.Decimal('0.00'),
        finalInclusiveAmount: new Prisma.Decimal('147500.00'),
        taxableAmount: new Prisma.Decimal('125000.00'),
        gstRate: new Prisma.Decimal('18.00'),
        cgstRate: new Prisma.Decimal('9.00'),
        cgstAmount: new Prisma.Decimal('11250.00'),
        sgstRate: new Prisma.Decimal('9.00'),
        sgstAmount: new Prisma.Decimal('11250.00'),
        igstRate: new Prisma.Decimal('0.00'),
        igstAmount: new Prisma.Decimal('0.00'),
        totalTax: new Prisma.Decimal('22500.00'),
        lineTotal: new Prisma.Decimal('147500.00'),
      },
    ],
  };

  it('formats Indian Rupee amounts and IST dates accurately', () => {
    expect(formatInrCurrency('125000.00')).toBe('₹1,25,000');
    expect(formatInrCurrency('125000.50')).toBe('₹1,25,000.50');
    expect(formatInrCurrency('999.00')).toBe('₹999');
    expect(formatInvoiceDateIst(new Date('2030-06-02T05:00:00.000Z'))).toBe('02 June, 2030');
    expect(escapeHtml('<script>"test"</script>')).toBe(
      '&lt;script&gt;&quot;test&quot;&lt;/script&gt;',
    );
  });

  it('renders intra-state invoice HTML with TIMMBR_BRAND_LOGO_URL, CGST and SGST rows (and omits IGST) and escapes HTML', () => {
    const html = renderInvoiceHtmlV1({
      invoice: sampleInvoice,
    });

    expect(html).toContain(TIMMBR_BRAND_LOGO_URL);
    expect(html).toContain('INV/26-27/000001');
    expect(html).toContain('CUST. ID: CUST01');
    expect(html).toContain('CGST');
    expect(html).toContain('SGST');
    expect(html).not.toContain('>IGST<');
    expect(html).toContain('₹1,25,000');
    expect(html).toContain('₹1,47,500');
    expect(html).toContain('Aarav &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('renders inter-state invoice HTML with IGST row only (omitting CGST and SGST) and VOID watermark when voided', () => {
    const interStateVoidInvoice = {
      ...sampleInvoice,
      status: InvoiceStatus.VOID,
      taxRegime: TaxRegime.INTER_STATE,
      placeOfSupplyState: 'Maharashtra',
      placeOfSupplyCode: '27',
      cgstTotal: new Prisma.Decimal('0.00'),
      sgstTotal: new Prisma.Decimal('0.00'),
      igstTotal: new Prisma.Decimal('22500.00'),
    };

    const html = renderInvoiceHtmlV1({
      invoice: interStateVoidInvoice,
    });

    expect(html).toContain('IGST');
    expect(html).not.toContain('>CGST<');
    expect(html).not.toContain('>SGST<');
    expect(html).toContain('class="void-watermark"');
    expect(html).toContain('Maharashtra (27)');
  });

  it('resolves TIMMBR_BRAND_LOGO_URL asset and fails on unsupported templateVersion', async () => {
    const renderer = new PdfRendererService();
    const assets = renderer.loadBundledAssets();
    expect(assets.logoDataUri).toBe(TIMMBR_BRAND_LOGO_URL);

    await expect(
      renderer.renderInvoicePdf({
        ...sampleInvoice,
        templateVersion: 'v99-unknown',
      }),
    ).rejects.toThrow('Unsupported invoice templateVersion');
  });
});
