import { byVariantId } from '@/common/utils/helpers';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RazorpayService } from './razorpay.service';
import { PaymentRepository } from './payment.repository';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaymentMapper } from './payment.mapper';
import { PaymentNotFoundException } from '@/common/exceptions/payment.exception';
import {
  OrderAccessForbiddenException,
  OrderNotPayableException,
} from '@/common/exceptions/order.exception';
import { CartStatus, InventoryTransactionType, OrderStatus, PaymentStatus } from '@prisma/client';

/** Statuses that mean the order was already placed (e.g. by the webhook), so a late verify is fine. */
const PLACED_STATUSES: readonly OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

const PAID_AFTER_EXPIRY_MESSAGE =
  'Your payment was received, but this order had already expired. It will be refunded; please place a new order.';

export interface VerifyPaymentResult {
  payment: PaymentResponseDto;
  orderId: string;
  orderStatus: OrderStatus;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly paymentRepository: PaymentRepository,
  ) {}

  async verifyPayment(userId: string, dto: VerifyPaymentDto): Promise<VerifyPaymentResult> {
    // 1. Verify Razorpay cryptographic signature
    this.razorpayService.verifyPaymentSignature({
      razorpayOrderId: dto.razorpayOrderId,
      razorpayPaymentId: dto.razorpayPaymentId,
      razorpaySignature: dto.razorpaySignature,
    });

    // 2. Find Payment record
    const payment = await this.paymentRepository.findByProviderOrderId(dto.razorpayOrderId);
    if (!payment) {
      throw new PaymentNotFoundException(
        `No payment found for Razorpay order ID ${dto.razorpayOrderId}`,
      );
    }

    // A valid signature proves the payment happened, not that it's this user's order.
    const order = await this.prisma.order.findUnique({ where: { id: payment.orderId } });
    if (order && order.userId !== userId) {
      throw new OrderAccessForbiddenException();
    }

    if (payment.status === PaymentStatus.PAID) {
      this.logger.log(`Payment ${payment.id} is already marked as PAID.`);
      if (order && !PLACED_STATUSES.includes(order.status)) {
        // Paid, but the order is cancelled: a retry must hear the same thing as the first answer.
        throw new OrderNotPayableException(PAID_AFTER_EXPIRY_MESSAGE);
      }
      return {
        payment: PaymentMapper.toResponse(payment),
        orderId: payment.orderId,
        orderStatus: order?.status ?? OrderStatus.CONFIRMED,
      };
    }

    // 3. Atomically update Payment, Order, and Inventory ledger
    const result = await this.prisma.$transaction(async (tx) => {
      // a. The money is in whatever happens to the order, so the payment is always recorded.
      const paidPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          providerPaymentId: dto.razorpayPaymentId,
        },
      });

      // b. Confirm the order only while it is still PENDING. The expiry cron and the webhook
      //    can get there first; confirming again would take the stock out a second time.
      const confirmed = await tx.order.updateMany({
        where: { id: payment.orderId, status: OrderStatus.PENDING },
        data: { status: OrderStatus.CONFIRMED, placedAt: new Date(), expiresAt: null },
      });

      if (confirmed.count === 0) {
        const current = await tx.order.findUnique({
          where: { id: payment.orderId },
          select: { status: true },
        });
        const status = current?.status ?? OrderStatus.CANCELLED;
        return { payment: paidPayment, status, placed: PLACED_STATUSES.includes(status) };
      }

      const updatedOrder = await tx.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        include: { items: true },
      });

      // c. Deduct reserved inventory & log SALE audit transaction
      for (const item of byVariantId(updatedOrder.items)) {
        if (item.variantId) {
          const inv = await tx.inventory.findUnique({
            where: { variantId: item.variantId },
          });

          if (inv) {
            const nextQty = Math.max(0, inv.quantity - item.quantity);
            const nextReserved = Math.max(0, inv.reservedQuantity - item.quantity);

            await tx.inventory.update({
              where: { id: inv.id },
              data: {
                quantity: nextQty,
                reservedQuantity: nextReserved,
              },
            });

            await tx.inventoryTransaction.create({
              data: {
                inventoryId: inv.id,
                type: InventoryTransactionType.SALE,
                quantity: -item.quantity,
                quantityBefore: inv.quantity,
                quantityAfter: nextQty,
                referenceType: 'ORDER',
                referenceId: updatedOrder.id,
                reason: `Order #${updatedOrder.id.substring(0, 8)} confirmed`,
              },
            });
          }
        }
      }

      // d. Atomically convert associated Cart if present
      if (updatedOrder.cartId) {
        await tx.cart.update({
          where: { id: updatedOrder.cartId },
          data: { status: CartStatus.CONVERTED },
        });
      }

      return { payment: paidPayment, status: OrderStatus.CONFIRMED, placed: true };
    });

    if (!result.placed) {
      this.logger.error(
        `Payment ${payment.id} was captured for order ${payment.orderId} in status ${result.status}. Needs a manual refund.`,
      );
      throw new OrderNotPayableException(PAID_AFTER_EXPIRY_MESSAGE);
    }

    return {
      payment: PaymentMapper.toResponse(result.payment),
      orderId: result.payment.orderId,
      orderStatus: result.status,
    };
  }

  async getPaymentByOrderId(orderId: string): Promise<PaymentResponseDto | null> {
    const payment = await this.paymentRepository.findByOrderId(orderId);
    return payment ? PaymentMapper.toResponse(payment) : null;
  }
}
