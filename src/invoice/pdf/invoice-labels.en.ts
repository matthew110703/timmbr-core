export interface InvoiceTemplateLabels {
  invoiceHeading: string;
  invoiceNoPrefix: string;
  customerIdPrefix: string;
  dateLabel: string;
  billedToLabel: string;
  fromLabel: string;
  gstinPrefix: string;
  placeOfSupplyPrefix: string;
  columnItem: string;
  columnHsn: string;
  columnQuantity: string;
  columnDiscount: string;
  columnAmount: string;
  shippingLabel: string;
  igstLabel: string;
  cgstLabel: string;
  sgstLabel: string;
  totalLabel: string;
  paymentMethodLabel: string;
  thankYouMessage: string;
  contactPrompt: string;
  voidWatermark: string;
}

export const INVOICE_LABELS_EN: InvoiceTemplateLabels = {
  invoiceHeading: 'INVOICE',
  invoiceNoPrefix: 'INV. NO:',
  customerIdPrefix: 'CUST. ID:',
  dateLabel: 'Date:',
  billedToLabel: 'Billed to:',
  fromLabel: 'From:',
  gstinPrefix: 'GSTIN:',
  placeOfSupplyPrefix: 'Place of Supply:',
  columnItem: 'Item',
  columnHsn: 'HSN CODE',
  columnQuantity: 'Quantity',
  columnDiscount: 'Discount',
  columnAmount: 'Amount',
  shippingLabel: 'Shipping',
  igstLabel: 'IGST',
  cgstLabel: 'CGST',
  sgstLabel: 'SGST',
  totalLabel: 'Total',
  paymentMethodLabel: 'Payment method:',
  thankYouMessage: 'Thanks for choosing us!',
  contactPrompt: 'If you have any questions about this invoice, please contact',
  voidWatermark: 'VOID',
};
