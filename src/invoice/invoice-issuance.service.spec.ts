import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import {
  InvoiceStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  TaxRegime,
} from '@prisma/client';
import {
  InvoiceIneligibleOrderException,
  InvoiceMissingHsnException,
} from '@/common/exceptions/invoice.exception';
import { env } from '@/config/env';
import { InvoiceIssuanceService } from './invoice-issuance.service';

describe('InvoiceIssuanceService', () => {
  let service: InvoiceIssuanceService;
  let mockPrisma: any;
  let tx: any;

  const baseOrder = {
    id: 'order-uuid-100',
    userId: 'user-uuid-999',
    status: OrderStatus.CONFIRMED,
    subtotal: new Prisma.Decimal('2124.00'),
    discount: new Prisma.Decimal('0.00'),
    shippingFee: new Prisma.Decimal('100.00'),
    tax: new Prisma.Decimal('324.00'),
    grandTotal: new Prisma.Decimal('2224.00'),
    currency: 'INR',
    shippingAddress: {
      firstName: 'Aarav',
      lastName: 'Sharma',
      phone: '+91 9876543210',
      line1: '12 MG Road',
      line2: 'Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
      country: 'India',
    },
    billingAddress: null,
    user: {
      id: 'user-uuid-999',
      name: 'Aarav Sharma',
      email: 'aarav@example.com',
      phone: '+91 9876543210',
    },
    items: [
      {
        id: 'oi-1',
        orderId: 'order-uuid-100',
        productId: 'prod-1',
        variantId: 'var-1',
        name: '2 Seater Sofa - SOFA-2S',
        sku: 'SOFA-2S',
        quantity: 2,
        originalUnitPrice: new Prisma.Decimal('1180.00'),
        unitPrice: new Prisma.Decimal('1062.00'),
        discountAmount: new Prisma.Decimal('236.00'),
        totalPrice: new Prisma.Decimal('2124.00'),
        hsnCode: '9401',
        gstRate: new Prisma.Decimal('18.00'),
        taxAmount: new Prisma.Decimal('324.00'),
      },
    ],
  };

  const basePayment: any = {
    id: 'pay-uuid-100',
    orderId: 'order-uuid-100',
    provider: PaymentProvider.RAZORPAY,
    providerOrderId: 'order_rzp_100',
    providerPaymentId: 'pay_rzp_100',
    amount: new Prisma.Decimal('2224.00'),
    currency: 'INR',
    status: PaymentStatus.PAID,
  };

  beforeEach(async () => {
    let seqCounter = 0;
    tx = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'inv-uuid-1',
            ...data,
            items: data.items.create.map((it: any, idx: number) => ({
              id: `inv-item-${idx + 1}`,
              invoiceId: 'inv-uuid-1',
              ...it,
            })),
          }),
        ),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue(baseOrder),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
      },
      $queryRaw: jest.fn().mockImplementation(() => {
        seqCounter += 1;
        return Promise.resolve([{ lastValue: seqCounter }]);
      }),
    };

    mockPrisma = {
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn((cb) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [InvoiceIssuanceService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<InvoiceIssuanceService>(InvoiceIssuanceService);
  });

  it('issues an immutable intra-state GST invoice and creates an OutboxEvent in the same transaction', async () => {
    const issuedAt = new Date('2026-06-02T10:00:00.000Z');
    const invoice = await service.issueForConfirmedOrderInTx(tx, {
      orderId: baseOrder.id,
      payment: basePayment,
      issuedAt,
    });

    expect(invoice.invoiceNumber).toBe('INV/26-27/000001');
    expect(invoice.financialYear).toBe('26-27');
    expect(invoice.status).toBe(InvoiceStatus.ISSUED);
    expect(invoice.taxRegime).toBe(TaxRegime.INTRA_STATE);
    expect(invoice.sellerStateCode).toBe('29');
    expect(invoice.placeOfSupplyCode).toBe('29');
    expect(invoice.subtotalGross.toFixed(2)).toBe('2360.00');
    expect(invoice.productDiscountTotal.toFixed(2)).toBe('236.00');
    expect(invoice.subtotalTaxable.toFixed(2)).toBe('1800.00');
    expect(invoice.cgstTotal.toFixed(2)).toBe('162.00');
    expect(invoice.sgstTotal.toFixed(2)).toBe('162.00');
    expect(invoice.igstTotal.toFixed(2)).toBe('0.00');
    expect(invoice.shippingFee.toFixed(2)).toBe('100.00');
    expect(invoice.grandTotal.toFixed(2)).toBe('2224.00');
    expect(tx.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aggregateType: 'INVOICE',
          aggregateId: 'inv-uuid-1',
          eventType: 'INVOICE_PDF_GENERATE',
          payload: { invoiceId: 'inv-uuid-1', version: 1 },
        }),
      }),
    );
  });

  it('is idempotent when an invoice already exists for the order (does not increment sequence or duplicate outbox event)', async () => {
    const existingInvoice = {
      id: 'inv-existing',
      invoiceNumber: 'INV/26-27/000005',
      orderId: baseOrder.id,
      items: [],
    };
    tx.invoice.findUnique.mockResolvedValueOnce(existingInvoice);

    const result = await service.issueForConfirmedOrderInTx(tx, {
      orderId: baseOrder.id,
      payment: basePayment,
    });

    expect(result).toBe(existingInvoice);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('rejects issuance if payment is not PAID or is a partial payment', async () => {
    await expect(
      service.issueForConfirmedOrderInTx(tx, {
        orderId: baseOrder.id,
        payment: { ...basePayment, status: PaymentStatus.PENDING },
      }),
    ).rejects.toThrow(InvoiceIneligibleOrderException);

    await expect(
      service.issueForConfirmedOrderInTx(tx, {
        orderId: baseOrder.id,
        payment: { ...basePayment, amount: new Prisma.Decimal('1000.00') },
      }),
    ).rejects.toThrow(InvoiceIneligibleOrderException);
  });

  it('rejects issuance if order is PENDING or CANCELLED', async () => {
    tx.order.findUnique.mockResolvedValueOnce({
      ...baseOrder,
      status: OrderStatus.CANCELLED,
    });

    await expect(
      service.issueForConfirmedOrderInTx(tx, {
        orderId: baseOrder.id,
        payment: basePayment,
      }),
    ).rejects.toThrow(InvoiceIneligibleOrderException);
  });

  it('enforces HSN validation when INVOICE_REQUIRE_HSN is enabled', async () => {
    const prevRequireHsn = env.INVOICE_REQUIRE_HSN;
    (env as any).INVOICE_REQUIRE_HSN = 'true';

    tx.order.findUnique.mockResolvedValueOnce({
      ...baseOrder,
      items: [{ ...baseOrder.items[0], hsnCode: null }],
    });

    try {
      await expect(
        service.issueForConfirmedOrderInTx(tx, {
          orderId: baseOrder.id,
          payment: basePayment,
        }),
      ).rejects.toThrow(InvoiceMissingHsnException);
    } finally {
      (env as any).INVOICE_REQUIRE_HSN = prevRequireHsn;
    }
  });

  it('safely catches invoice issuance errors after order confirmation and flags invoiceIssueError on Order without throwing', async () => {
    tx.order.findUnique.mockResolvedValueOnce({
      ...baseOrder,
      shippingAddress: { ...baseOrder.shippingAddress, state: '' },
    });

    const result = await service.issueForConfirmedOrderSafely({
      orderId: baseOrder.id,
      payment: basePayment,
    });

    expect(result).toBeNull();
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: baseOrder.id },
      data: { invoiceIssueError: expect.stringContaining('shipping state') },
    });
  });
});
