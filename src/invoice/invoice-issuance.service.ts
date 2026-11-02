import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  InvoiceEmailStatus,
  InvoicePdfStatus,
  InvoiceStatus,
  OrderStatus,
  OutboxEventStatus,
  Payment,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import {
  InvoiceIneligibleOrderException,
  InvoiceMissingHsnException,
} from '@/common/exceptions/invoice.exception';
import { OrderNotFoundException } from '@/common/exceptions/order.exception';
import { getValidatedSellerConfig } from './utils/seller-config.util';
import { resolveGstState, resolvePlaceOfSupply } from './utils/gst-place-of-supply.util';
import {
  buildInvoiceSequenceSeries,
  formatCustomerCode,
  formatGstInvoiceNumber,
  getIndianFinancialYearShort,
} from './utils/invoice-number.util';
import { calculateInvoiceFinancials } from './utils/invoice-math.util';
import {
  INVOICE_TEMPLATE_VERSION_V1,
  OUTBOX_AGGREGATE_INVOICE,
  OUTBOX_EVENT_INVOICE_PDF_GENERATE,
} from './queue/invoice.queue.constants';
import { InvoiceWithItems } from './invoice.repository';

const ELIGIBLE_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

export interface IssueInvoiceParams {
  orderId: string;
  payment: Payment;
  issuedAt?: Date;
}

export interface InvoiceAddressSnapshot {
  name: string;
  email: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  stateCode: string | null;
  postalCode: string;
  country: string;
}

export interface InvoicePaymentSnapshot {
  paymentId: string;
  provider: string;
  methodLabel: string;
  description: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amount: string;
  currency: string;
}

@Injectable()
export class InvoiceIssuanceService {
  private readonly logger = new Logger(InvoiceIssuanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Issues an immutable GST invoice inside an existing PostgreSQL transaction
   * right after payment verification and order confirmation + inventory deduction.
   *
   * Idempotent: if an invoice already exists for `orderId`, returns it without
   * incrementing the sequence or creating a duplicate outbox event.
   */
  async issueForConfirmedOrderInTx(
    tx: Prisma.TransactionClient,
    params: IssueInvoiceParams,
  ): Promise<InvoiceWithItems> {
    // 1. Idempotency check: one invoice per order
    const existing = await tx.invoice.findUnique({
      where: { orderId: params.orderId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (existing) {
      this.logger.log(
        `Invoice ${existing.invoiceNumber} already exists for order ${params.orderId} — returning existing record.`,
      );
      return existing;
    }

    // 2. Load order with immutable item snapshots and user
    const order = await tx.order.findUnique({
      where: { id: params.orderId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!order) {
      throw new OrderNotFoundException(`Order ${params.orderId} not found for invoice issuance.`);
    }

    // 3. Verify order confirmation state
    if (!ELIGIBLE_ORDER_STATUSES.includes(order.status)) {
      throw new InvoiceIneligibleOrderException(
        `Order ${order.id} is in status ${order.status} and is not eligible for invoice issuance.`,
      );
    }

    // 4. Verify full payment
    if (params.payment.status !== PaymentStatus.PAID) {
      throw new InvoiceIneligibleOrderException(
        `Payment ${params.payment.id} for order ${order.id} has status ${params.payment.status}; full PAID status is required.`,
      );
    }

    const paymentAmountDec = new Prisma.Decimal(params.payment.amount).toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
    );
    const orderGrandTotalDec = new Prisma.Decimal(order.grandTotal).toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
    );

    if (!paymentAmountDec.equals(orderGrandTotalDec)) {
      throw new InvoiceIneligibleOrderException(
        `Partial or mismatched payment amount (${paymentAmountDec.toFixed(2)}) for order ${order.id} (expected ${orderGrandTotalDec.toFixed(2)}).`,
      );
    }

    // 5. Validate seller configuration
    const { prefix, requireHsn, seller } = getValidatedSellerConfig();

    // 6. Verify shipping state and resolve Place of Supply (never fall back to billing state)
    const rawShipping = (order.shippingAddress ?? {}) as Record<string, unknown>;
    const shippingStateRaw = typeof rawShipping.state === 'string' ? rawShipping.state : undefined;

    const placeOfSupply = resolvePlaceOfSupply({
      sellerStateCode: seller.stateCode,
      sellerStateName: seller.state,
      shippingState: shippingStateRaw,
    });

    // 7. Validate required HSN values when production validation gate is enabled
    if (requireHsn) {
      for (const item of order.items) {
        if (!item.hsnCode || item.hsnCode.trim() === '') {
          this.logger.error(
            { orderId: order.id, sku: item.sku },
            'Missing HSN code on order item when INVOICE_REQUIRE_HSN is enabled',
          );
          throw new InvoiceMissingHsnException(item.sku);
        }
      }
    }

    // 8. Calculate GST-inclusive line values & tax breakdowns using Prisma.Decimal
    //    (reads gstRate and prices strictly from OrderItem snapshots, never from live Product)
    const financials = calculateInvoiceFinancials({
      items: order.items.map((item) => ({
        orderItemId: item.id,
        productId: item.productId,
        variantId: item.variantId,
        title: item.name,
        sku: item.sku,
        hsnCode: item.hsnCode,
        quantity: item.quantity,
        originalUnitPrice: item.originalUnitPrice ?? item.unitPrice,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        totalPrice: item.totalPrice,
        gstRate: item.gstRate,
      })),
      taxRegime: placeOfSupply.taxRegime,
      orderDiscount: order.discount,
      orderShippingFee: order.shippingFee,
      orderGrandTotal: order.grandTotal,
    });

    // 9. Determine financial year from actual issuance timestamp in Asia/Kolkata and allocate sequence atomically
    const issuedAt = params.issuedAt ?? new Date();
    const financialYear = getIndianFinancialYearShort(issuedAt);
    const series = buildInvoiceSequenceSeries(seller.gstin, prefix, financialYear);

    const seqRows = await tx.$queryRaw<Array<{ lastValue: number }>>(Prisma.sql`
      INSERT INTO "InvoiceSequence" ("series", "sellerGstin", "financialYear", "prefix", "lastValue", "updatedAt")
      VALUES (${series}, ${seller.gstin}, ${financialYear}, ${prefix}, 1, NOW())
      ON CONFLICT ("series")
      DO UPDATE SET
        "lastValue" = "InvoiceSequence"."lastValue" + 1,
        "updatedAt" = NOW()
      RETURNING "lastValue"
    `);

    const sequenceValue = Number(seqRows[0]?.lastValue ?? 1);
    const invoiceNumber = formatGstInvoiceNumber(prefix, financialYear, sequenceValue);

    // 10. Build immutable customer, address, and payment snapshots
    const rawBilling = (order.billingAddress as Record<string, unknown> | null) ?? rawShipping;

    const customerEmail =
      (typeof rawBilling.email === 'string' && rawBilling.email.trim()) || order.user.email;

    const shippingAddressSnapshot: InvoiceAddressSnapshot = this.buildAddressSnapshot(
      rawShipping,
      order.user,
      customerEmail,
      placeOfSupply.placeOfSupplyCode,
    );

    const billingStateResolved = resolveGstState(
      typeof rawBilling.state === 'string' ? rawBilling.state : undefined,
    );
    const billingAddressSnapshot: InvoiceAddressSnapshot = this.buildAddressSnapshot(
      rawBilling,
      order.user,
      customerEmail,
      billingStateResolved?.code ?? placeOfSupply.placeOfSupplyCode,
    );

    const paymentSnapshot: InvoicePaymentSnapshot = {
      paymentId: params.payment.id,
      provider: params.payment.provider,
      methodLabel:
        params.payment.provider === 'RAZORPAY' ? 'Online (Razorpay)' : params.payment.provider,
      description: params.payment.providerPaymentId
        ? `Ref: ${params.payment.providerPaymentId}`
        : `Order Ref: ${params.payment.providerOrderId ?? order.id.slice(0, 8)}`,
      providerOrderId: params.payment.providerOrderId ?? null,
      providerPaymentId: params.payment.providerPaymentId ?? null,
      amount: paymentAmountDec.toFixed(2),
      currency: params.payment.currency,
    };

    const customerCode = formatCustomerCode(order.userId);

    // 11. Create immutable Invoice + InvoiceItem records
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        financialYear,
        templateVersion: INVOICE_TEMPLATE_VERSION_V1,
        orderId: order.id,
        userId: order.userId,
        status: InvoiceStatus.ISSUED,
        pdfStatus: InvoicePdfStatus.PENDING,
        emailStatus: InvoiceEmailStatus.PENDING,
        taxRegime: placeOfSupply.taxRegime,
        sellerGstin: seller.gstin,
        sellerState: placeOfSupply.sellerStateName,
        sellerStateCode: placeOfSupply.sellerStateCode,
        placeOfSupplyState: placeOfSupply.placeOfSupplyState,
        placeOfSupplyCode: placeOfSupply.placeOfSupplyCode,
        currency: order.currency,
        subtotalGross: financials.subtotalGross,
        productDiscountTotal: financials.productDiscountTotal,
        subtotalDiscounted: financials.subtotalDiscounted,
        subtotalTaxable: financials.subtotalTaxable,
        shippingFee: financials.shippingFee,
        shippingTaxable: financials.shippingTaxable,
        shippingTax: financials.shippingTax,
        cgstTotal: financials.cgstTotal,
        sgstTotal: financials.sgstTotal,
        igstTotal: financials.igstTotal,
        taxTotal: financials.taxTotal,
        grandTotal: financials.grandTotal,
        customerCode,
        customerEmail,
        sellerSnapshot: seller as unknown as Prisma.InputJsonValue,
        billingAddress: billingAddressSnapshot as unknown as Prisma.InputJsonValue,
        shippingAddress: shippingAddressSnapshot as unknown as Prisma.InputJsonValue,
        paymentSnapshot: paymentSnapshot as unknown as Prisma.InputJsonValue,
        issuedAt,
        pdfGenerationVersion: 1,
        items: {
          create: financials.lines.map((line) => ({
            orderItemId: line.orderItemId,
            productId: line.productId,
            variantId: line.variantId,
            title: line.title,
            sku: line.sku,
            hsnCode: line.hsnCode,
            quantity: line.quantity,
            originalUnitPrice: line.originalUnitPrice,
            unitPrice: line.unitPrice,
            grossAmount: line.grossAmount,
            productDiscount: line.productDiscount,
            finalInclusiveAmount: line.finalInclusiveAmount,
            taxableAmount: line.taxableAmount,
            gstRate: line.gstRate,
            cgstRate: line.cgstRate,
            cgstAmount: line.cgstAmount,
            sgstRate: line.sgstRate,
            sgstAmount: line.sgstAmount,
            igstRate: line.igstRate,
            igstAmount: line.igstAmount,
            totalTax: line.totalTax,
            lineTotal: line.lineTotal,
          })),
        },
      },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
      },
    });

    // 12. Create transactional outbox event for asynchronous PDF generation
    await tx.outboxEvent.create({
      data: {
        aggregateType: OUTBOX_AGGREGATE_INVOICE,
        aggregateId: invoice.id,
        eventType: OUTBOX_EVENT_INVOICE_PDF_GENERATE,
        payload: {
          invoiceId: invoice.id,
          version: invoice.pdfGenerationVersion,
        },
        status: OutboxEventStatus.PENDING,
        nextAttemptAt: new Date(),
      },
    });

    this.logger.log(
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        orderId: order.id,
        taxRegime: invoice.taxRegime,
        grandTotal: invoice.grandTotal.toFixed(2),
      },
      `Issued GST invoice ${invoice.invoiceNumber} for order ${order.id}`,
    );

    return invoice;
  }

  /**
   * Issues an immutable GST invoice for an already-committed confirmed order and PAID payment.
   * If issuance fails (e.g., missing HSN code in prod or seller config issue), records
   * `invoiceIssueError` on the Order for administrative resolution without rolling back
   * the customer's captured payment or confirmed order.
   */
  async issueForConfirmedOrderSafely(params: IssueInvoiceParams): Promise<InvoiceWithItems | null> {
    try {
      return await this.prisma.$transaction((tx) => this.issueForConfirmedOrderInTx(tx, params));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        { orderId: params.orderId, paymentId: params.payment.id, err: message },
        'Failed to issue GST invoice after order confirmation — recording invoiceIssueError on Order',
      );
      await this.prisma.order
        .updateMany({
          where: { id: params.orderId },
          data: { invoiceIssueError: message },
        })
        .catch((flagErr) =>
          this.logger.error(
            { orderId: params.orderId, err: flagErr },
            'Failed to record invoiceIssueError on order',
          ),
        );
      return null;
    }
  }

  private buildAddressSnapshot(
    raw: Record<string, unknown>,
    user: { name: string; email: string; phone: string | null },
    email: string,
    stateCode: string | null,
  ): InvoiceAddressSnapshot {
    const firstName = typeof raw.firstName === 'string' ? raw.firstName.trim() : '';
    const lastName = typeof raw.lastName === 'string' ? raw.lastName.trim() : '';
    const fullName = `${firstName} ${lastName}`.trim() || user.name || 'Customer';

    return {
      name: fullName,
      email,
      phone: (typeof raw.phone === 'string' && raw.phone.trim()) || user.phone || '',
      line1: typeof raw.line1 === 'string' ? raw.line1.trim() : '',
      line2: typeof raw.line2 === 'string' && raw.line2.trim() !== '' ? raw.line2.trim() : null,
      city: typeof raw.city === 'string' ? raw.city.trim() : '',
      state: typeof raw.state === 'string' ? raw.state.trim() : '',
      stateCode,
      postalCode: typeof raw.postalCode === 'string' ? raw.postalCode.trim() : '',
      country: typeof raw.country === 'string' ? raw.country.trim() : 'India',
    };
  }
}
