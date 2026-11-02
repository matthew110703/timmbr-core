import { Prisma, TaxRegime } from '@prisma/client';
import { InvoiceReconciliationException } from '@/common/exceptions/invoice.exception';

const D = Prisma.Decimal;
const ROUND = Prisma.Decimal.ROUND_HALF_UP;
const ZERO = new D(0);
const TWO = new D(2);
const HUNDRED = new D(100);
const ONE = new D(1);

function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, ROUND);
}

export interface OrderItemTaxInput {
  orderItemId: string;
  productId?: string | null;
  variantId?: string | null;
  title: string;
  sku: string;
  hsnCode?: string | null;
  quantity: number;
  originalUnitPrice?: Prisma.Decimal | number | string | null;
  unitPrice: Prisma.Decimal | number | string;
  discountAmount?: Prisma.Decimal | number | string | null;
  totalPrice: Prisma.Decimal | number | string;
  gstRate: Prisma.Decimal | number | string;
}

export interface CalculatedInvoiceLine {
  orderItemId: string;
  productId: string | null;
  variantId: string | null;
  title: string;
  sku: string;
  hsnCode: string | null;
  quantity: number;
  originalUnitPrice: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  grossAmount: Prisma.Decimal;
  productDiscount: Prisma.Decimal;
  finalInclusiveAmount: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  gstRate: Prisma.Decimal;
  cgstRate: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstRate: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstRate: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  totalTax: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

export interface CalculatedInvoiceTotals {
  lines: CalculatedInvoiceLine[];
  subtotalGross: Prisma.Decimal;
  productDiscountTotal: Prisma.Decimal;
  subtotalDiscounted: Prisma.Decimal;
  subtotalTaxable: Prisma.Decimal;
  shippingFee: Prisma.Decimal;
  shippingTaxable: Prisma.Decimal;
  shippingTax: Prisma.Decimal;
  cgstTotal: Prisma.Decimal;
  sgstTotal: Prisma.Decimal;
  igstTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
}

/**
 * Pure Prisma.Decimal calculation for GST-inclusive product lines, product-level discounts,
 * intra/inter-state GST split, non-taxable v1 shipping fee, and strict order reconciliation.
 *
 * Order-level / coupon discounts are explicitly rejected in v1.
 */
export function calculateInvoiceFinancials(params: {
  items: OrderItemTaxInput[];
  taxRegime: TaxRegime;
  orderDiscount: Prisma.Decimal | number | string;
  orderShippingFee: Prisma.Decimal | number | string;
  orderGrandTotal: Prisma.Decimal | number | string;
}): CalculatedInvoiceTotals {
  if (!params.items || params.items.length === 0) {
    throw new InvoiceReconciliationException('Cannot calculate invoice with zero order items.');
  }

  const orderDiscountDec = round2(new D(params.orderDiscount));
  if (orderDiscountDec.gt(ZERO)) {
    throw new InvoiceReconciliationException(
      'Order-level / coupon discounts are not supported in v1 invoice calculation.',
      { orderDiscount: orderDiscountDec.toFixed(2) },
    );
  }

  const shippingFeeDec = round2(new D(params.orderShippingFee));
  if (shippingFeeDec.lt(ZERO)) {
    throw new InvoiceReconciliationException('Shipping fee cannot be negative.', {
      shippingFee: shippingFeeDec.toFixed(2),
    });
  }

  const orderGrandTotalDec = round2(new D(params.orderGrandTotal));

  const lines: CalculatedInvoiceLine[] = [];
  let subtotalGross = ZERO;
  let productDiscountTotal = ZERO;
  let subtotalDiscounted = ZERO;
  let subtotalTaxable = ZERO;
  let cgstTotal = ZERO;
  let sgstTotal = ZERO;
  let igstTotal = ZERO;

  for (const item of params.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new InvoiceReconciliationException(
        `Invalid item quantity ${item.quantity} for SKU "${item.sku}".`,
      );
    }

    const qty = new D(item.quantity);
    const unitPrice = round2(new D(item.unitPrice));
    const rawOriginalUnitPrice =
      item.originalUnitPrice !== undefined && item.originalUnitPrice !== null
        ? round2(new D(item.originalUnitPrice))
        : unitPrice;

    const originalUnitPrice = rawOriginalUnitPrice.gt(unitPrice) ? rawOriginalUnitPrice : unitPrice;

    const grossAmount = round2(originalUnitPrice.mul(qty));
    const finalInclusiveAmount = round2(new D(item.totalPrice));
    const expectedDiscountedTotal = round2(unitPrice.mul(qty));

    if (!finalInclusiveAmount.equals(expectedDiscountedTotal)) {
      throw new InvoiceReconciliationException(
        `Line totalPrice (${finalInclusiveAmount.toFixed(2)}) does not match unitPrice * quantity (${expectedDiscountedTotal.toFixed(2)}) for SKU "${item.sku}".`,
        {
          sku: item.sku,
          unitPrice: unitPrice.toFixed(2),
          quantity: item.quantity,
          totalPrice: finalInclusiveAmount.toFixed(2),
        },
      );
    }

    const productDiscount = round2(grossAmount.minus(finalInclusiveAmount));
    if (productDiscount.lt(ZERO)) {
      throw new InvoiceReconciliationException(
        `Calculated product discount cannot be negative for SKU "${item.sku}".`,
      );
    }

    const gstRate = round2(new D(item.gstRate));
    if (gstRate.lt(ZERO)) {
      throw new InvoiceReconciliationException(
        `GST rate cannot be negative for SKU "${item.sku}".`,
      );
    }

    // Extract GST from final discounted GST-inclusive amount:
    // Taxable Value = Final Inclusive Amount / (1 + GST Rate / 100)
    // GST Amount = Final Inclusive Amount - Taxable Value
    const divisor = ONE.plus(gstRate.div(HUNDRED));
    const taxableAmount = round2(finalInclusiveAmount.div(divisor));
    const totalTax = round2(finalInclusiveAmount.minus(taxableAmount));

    let cgstRate = ZERO;
    let cgstAmount = ZERO;
    let sgstRate = ZERO;
    let sgstAmount = ZERO;
    let igstRate = ZERO;
    let igstAmount = ZERO;

    if (params.taxRegime === TaxRegime.INTRA_STATE) {
      cgstRate = round2(gstRate.div(TWO));
      sgstRate = round2(gstRate.minus(cgstRate));
      cgstAmount = round2(totalTax.div(TWO));
      // Remainder goes to SGST so CGST + SGST reconciles 100% with line totalTax
      sgstAmount = round2(totalTax.minus(cgstAmount));
    } else {
      igstRate = gstRate;
      igstAmount = totalTax;
    }

    // Invariant 1: CGST + SGST + IGST = Line Tax
    const sumLineTax = round2(cgstAmount.plus(sgstAmount).plus(igstAmount));
    if (!sumLineTax.equals(totalTax)) {
      throw new InvoiceReconciliationException(
        `Line tax components (${sumLineTax.toFixed(2)}) do not equal line totalTax (${totalTax.toFixed(2)}) for SKU "${item.sku}".`,
      );
    }

    // Invariant 2: Taxable Amount + Line Tax = Discounted GST-inclusive Line Total
    const lineTotal = round2(taxableAmount.plus(totalTax));
    if (!lineTotal.equals(finalInclusiveAmount)) {
      throw new InvoiceReconciliationException(
        `Line taxableAmount + totalTax (${lineTotal.toFixed(2)}) does not equal finalInclusiveAmount (${finalInclusiveAmount.toFixed(2)}) for SKU "${item.sku}".`,
      );
    }

    lines.push({
      orderItemId: item.orderItemId,
      productId: item.productId ?? null,
      variantId: item.variantId ?? null,
      title: item.title,
      sku: item.sku,
      hsnCode: item.hsnCode ? item.hsnCode.trim() : null,
      quantity: item.quantity,
      originalUnitPrice,
      unitPrice,
      grossAmount,
      productDiscount,
      finalInclusiveAmount,
      taxableAmount,
      gstRate,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      totalTax,
      lineTotal,
    });

    subtotalGross = round2(subtotalGross.plus(grossAmount));
    productDiscountTotal = round2(productDiscountTotal.plus(productDiscount));
    subtotalDiscounted = round2(subtotalDiscounted.plus(finalInclusiveAmount));
    subtotalTaxable = round2(subtotalTaxable.plus(taxableAmount));
    cgstTotal = round2(cgstTotal.plus(cgstAmount));
    sgstTotal = round2(sgstTotal.plus(sgstAmount));
    igstTotal = round2(igstTotal.plus(igstAmount));
  }

  // Shipping is treated as a separate non-taxable amount in v1
  const shippingTaxable = ZERO;
  const shippingTax = ZERO;

  const taxTotal = round2(cgstTotal.plus(sgstTotal).plus(igstTotal));

  // Invariant 3: Invoice Taxable Subtotal + Total GST + Shipping Fee = Invoice Grand Total
  const grandTotal = round2(subtotalTaxable.plus(taxTotal).plus(shippingFeeDec));

  // Invariant 4: Invoice Grand Total = Order Grand Total
  if (!grandTotal.equals(orderGrandTotalDec)) {
    throw new InvoiceReconciliationException(
      `Invoice grandTotal (${grandTotal.toFixed(2)}) does not reconcile with Order grandTotal (${orderGrandTotalDec.toFixed(2)}).`,
      {
        subtotalTaxable: subtotalTaxable.toFixed(2),
        taxTotal: taxTotal.toFixed(2),
        shippingFee: shippingFeeDec.toFixed(2),
        invoiceGrandTotal: grandTotal.toFixed(2),
        orderGrandTotal: orderGrandTotalDec.toFixed(2),
      },
    );
  }

  return {
    lines,
    subtotalGross,
    productDiscountTotal,
    subtotalDiscounted,
    subtotalTaxable,
    shippingFee: shippingFeeDec,
    shippingTaxable,
    shippingTax,
    cgstTotal,
    sgstTotal,
    igstTotal,
    taxTotal,
    grandTotal,
  };
}
