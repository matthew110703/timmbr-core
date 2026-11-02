import { Prisma, TaxRegime } from '@prisma/client';
import {
  InvoiceInvalidShippingStateException,
  InvoiceReconciliationException,
} from '@/common/exceptions/invoice.exception';
import { resolveGstState, resolvePlaceOfSupply } from './gst-place-of-supply.util';
import {
  buildInvoiceSequenceSeries,
  formatCustomerCode,
  formatGstInvoiceNumber,
  getIndianFinancialYearShort,
} from './invoice-number.util';
import { calculateInvoiceFinancials } from './invoice-math.util';

describe('Invoice Utilities (Numbering, GST Place of Supply, and Decimal Math)', () => {
  describe('getIndianFinancialYearShort & formatGstInvoiceNumber', () => {
    it('handles March 31 23:59:59 IST boundary as previous financial year', () => {
      // 2026-03-31 23:59:59 IST === 2026-03-31 18:29:59 UTC
      const march31Ist = new Date('2026-03-31T18:29:59.000Z');
      expect(getIndianFinancialYearShort(march31Ist)).toBe('25-26');
    });

    it('handles April 1 00:00:00 IST boundary as new financial year', () => {
      // 2026-04-01 00:00:00 IST === 2026-03-31 18:30:00 UTC
      const april1Ist = new Date('2026-03-31T18:30:00.000Z');
      expect(getIndianFinancialYearShort(april1Ist)).toBe('26-27');
    });

    it('formats GST Rule 46 compliant invoice numbers within 16 characters', () => {
      const invNo = formatGstInvoiceNumber('INV', '26-27', 1);
      expect(invNo).toBe('INV/26-27/000001');
      expect(invNo.length).toBeLessThanOrEqual(16);

      const invNo2 = formatGstInvoiceNumber('TM', '27-28', 42);
      expect(invNo2).toBe('TM/27-28/000042');
      expect(invNo2.length).toBe(15);
    });

    it('rejects prefixes longer than 3 characters to enforce the 16-char GST limit', () => {
      expect(() => formatGstInvoiceNumber('INVOICE', '26-27', 1)).toThrow();
      expect(() => formatGstInvoiceNumber('INV', '26-27', 0)).toThrow();
      expect(() => formatGstInvoiceNumber('INV', '26-27', 1_000_000)).toThrow();
    });

    it('builds seller-scoped sequence series key and customer code', () => {
      expect(buildInvoiceSequenceSeries('29AABCT1234F1Z5', 'INV', '26-27')).toBe(
        '29AABCT1234F1Z5:INV/26-27',
      );
      expect(formatCustomerCode('a1b2c3d4-e5f6')).toBe('A1B2C3');
    });
  });

  describe('resolveGstState & resolvePlaceOfSupply', () => {
    it('resolves intra-state (CGST+SGST) when seller and shipping states match', () => {
      const pos = resolvePlaceOfSupply({
        sellerStateCode: '29',
        sellerStateName: 'Karnataka',
        shippingState: 'karnataka',
      });

      expect(pos.taxRegime).toBe(TaxRegime.INTRA_STATE);
      expect(pos.sellerStateCode).toBe('29');
      expect(pos.placeOfSupplyCode).toBe('29');
      expect(pos.placeOfSupplyState).toBe('Karnataka');
    });

    it('resolves inter-state (IGST) when seller and shipping state codes differ', () => {
      const pos = resolvePlaceOfSupply({
        sellerStateCode: '29',
        sellerStateName: 'Karnataka',
        shippingState: 'Maharashtra',
      });

      expect(pos.taxRegime).toBe(TaxRegime.INTER_STATE);
      expect(pos.sellerStateCode).toBe('29');
      expect(pos.placeOfSupplyCode).toBe('27');
      expect(pos.placeOfSupplyState).toBe('Maharashtra');
    });

    it('rejects missing or unknown shipping states without guessing or falling back', () => {
      expect(() =>
        resolvePlaceOfSupply({
          sellerStateCode: '29',
          shippingState: '',
        }),
      ).toThrow(InvoiceInvalidShippingStateException);

      expect(() =>
        resolvePlaceOfSupply({
          sellerStateCode: '29',
          shippingState: 'UnknownStateLand',
        }),
      ).toThrow(InvoiceInvalidShippingStateException);

      expect(resolveGstState(null)).toBeNull();
    });
  });

  describe('calculateInvoiceFinancials (Prisma.Decimal precision & GST extraction)', () => {
    it('extracts GST from GST-inclusive price accurately (₹1,180 @ 18% -> ₹1,000 taxable + ₹180 GST)', () => {
      const result = calculateInvoiceFinancials({
        items: [
          {
            orderItemId: 'oi-1',
            title: 'Teak Chair',
            sku: 'CHAIR-01',
            hsnCode: '9401',
            quantity: 1,
            originalUnitPrice: '1180.00',
            unitPrice: '1180.00',
            totalPrice: '1180.00',
            gstRate: '18',
          },
        ],
        taxRegime: TaxRegime.INTRA_STATE,
        orderDiscount: '0',
        orderShippingFee: '0',
        orderGrandTotal: '1180.00',
      });

      const line = result.lines[0];
      expect(line.taxableAmount.toFixed(2)).toBe('1000.00');
      expect(line.totalTax.toFixed(2)).toBe('180.00');
      expect(line.cgstRate.toFixed(2)).toBe('9.00');
      expect(line.sgstRate.toFixed(2)).toBe('9.00');
      expect(line.cgstAmount.toFixed(2)).toBe('90.00');
      expect(line.sgstAmount.toFixed(2)).toBe('90.00');
      expect(line.igstAmount.toFixed(2)).toBe('0.00');
      expect(line.lineTotal.toFixed(2)).toBe('1180.00');
      expect(result.grandTotal.toFixed(2)).toBe('1180.00');
    });

    it('applies product-level discount before extracting GST (₹1,180 -> ₹1,062 @ 18% => ₹900 taxable + ₹162 GST)', () => {
      const result = calculateInvoiceFinancials({
        items: [
          {
            orderItemId: 'oi-1',
            title: 'Discounted Sofa',
            sku: 'SOFA-DISC',
            hsnCode: '9401',
            quantity: 1,
            originalUnitPrice: new Prisma.Decimal('1180.00'),
            unitPrice: new Prisma.Decimal('1062.00'),
            totalPrice: new Prisma.Decimal('1062.00'),
            gstRate: new Prisma.Decimal('18'),
          },
        ],
        taxRegime: TaxRegime.INTER_STATE,
        orderDiscount: 0,
        orderShippingFee: 0,
        orderGrandTotal: '1062.00',
      });

      const line = result.lines[0];
      expect(line.grossAmount.toFixed(2)).toBe('1180.00');
      expect(line.productDiscount.toFixed(2)).toBe('118.00');
      expect(line.finalInclusiveAmount.toFixed(2)).toBe('1062.00');
      expect(line.taxableAmount.toFixed(2)).toBe('900.00');
      expect(line.totalTax.toFixed(2)).toBe('162.00');
      expect(line.igstRate.toFixed(2)).toBe('18.00');
      expect(line.igstAmount.toFixed(2)).toBe('162.00');
      expect(line.cgstAmount.toFixed(2)).toBe('0.00');
      expect(line.sgstAmount.toFixed(2)).toBe('0.00');
      expect(result.productDiscountTotal.toFixed(2)).toBe('118.00');
      expect(result.igstTotal.toFixed(2)).toBe('162.00');
      expect(result.grandTotal.toFixed(2)).toBe('1062.00');
    });

    it('reconciles odd-paisa intra-state CGST + SGST exactly with line totalTax and includes non-taxable v1 shipping fee', () => {
      // Price ₹999.00 @ 18% -> taxable = 999 / 1.18 = 846.61, tax = 152.39 (odd paise!)
      // CGST = 76.20, SGST = 76.19 -> CGST + SGST = 152.39
      const result = calculateInvoiceFinancials({
        items: [
          {
            orderItemId: 'oi-odd',
            title: 'Lamp',
            sku: 'LAMP-999',
            hsnCode: '9405',
            quantity: 1,
            originalUnitPrice: '999.00',
            unitPrice: '999.00',
            totalPrice: '999.00',
            gstRate: '18',
          },
        ],
        taxRegime: TaxRegime.INTRA_STATE,
        orderDiscount: '0',
        orderShippingFee: '150.00',
        orderGrandTotal: '1149.00',
      });

      const line = result.lines[0];
      expect(line.taxableAmount.toFixed(2)).toBe('846.61');
      expect(line.totalTax.toFixed(2)).toBe('152.39');
      expect(line.cgstAmount.plus(line.sgstAmount).toFixed(2)).toBe('152.39');
      expect(result.shippingFee.toFixed(2)).toBe('150.00');
      expect(result.shippingTax.toFixed(2)).toBe('0.00');
      expect(result.subtotalTaxable.plus(result.taxTotal).plus(result.shippingFee).toFixed(2)).toBe(
        '1149.00',
      );
      expect(result.grandTotal.toFixed(2)).toBe('1149.00');
    });

    it('rejects order-level discounts in v1', () => {
      expect(() =>
        calculateInvoiceFinancials({
          items: [
            {
              orderItemId: 'oi-1',
              title: 'Chair',
              sku: 'CH-1',
              quantity: 1,
              unitPrice: '1180.00',
              totalPrice: '1180.00',
              gstRate: '18',
            },
          ],
          taxRegime: TaxRegime.INTRA_STATE,
          orderDiscount: '100.00',
          orderShippingFee: '0',
          orderGrandTotal: '1080.00',
        }),
      ).toThrow(InvoiceReconciliationException);
    });

    it('rejects when invoice grandTotal does not reconcile with order grandTotal', () => {
      expect(() =>
        calculateInvoiceFinancials({
          items: [
            {
              orderItemId: 'oi-1',
              title: 'Chair',
              sku: 'CH-1',
              quantity: 1,
              unitPrice: '1180.00',
              totalPrice: '1180.00',
              gstRate: '18',
            },
          ],
          taxRegime: TaxRegime.INTRA_STATE,
          orderDiscount: '0',
          orderShippingFee: '0',
          orderGrandTotal: '1250.00',
        }),
      ).toThrow(InvoiceReconciliationException);
    });
  });
});
