import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RazorpayService } from './razorpay.service';
import { PaymentRepository } from './payment.repository';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaymentMapper } from './payment.mapper';
import { PaymentNotFoundException } from '@/common/exceptions/payment.exception';
import { InventoryTransactionType, OrderStatus, PaymentStatus } from '@prisma/client';

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

  async verifyPayment(dto: VerifyPaymentDto): Promise<VerifyPaymentResult> {
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

    if (payment.status === PaymentStatus.PAID) {
      this.logger.log(`Payment ${payment.id} is already marked as PAID.`);
      const order = await this.prisma.order.findUnique({ where: { id: payment.orderId } });
      return {
        payment: PaymentMapper.toResponse(payment),
        orderId: payment.orderId,
        orderStatus: order?.status ?? OrderStatus.CONFIRMED,
      };
    }

    // 3. Atomically update Payment, Order, and Inventory ledger
    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      // a. Update Payment
      const paidPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          providerPaymentId: dto.razorpayPaymentId,
        },
      });

      // b. Update Order
      const updatedOrder = await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: OrderStatus.CONFIRMED,
          placedAt: new Date(),
        },
        include: { items: true },
      });

      // c. Deduct reserved inventory & log SALE audit transaction
      for (const item of updatedOrder.items) {
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

      return paidPayment;
    });

    return {
      payment: PaymentMapper.toResponse(updatedPayment),
      orderId: updatedPayment.orderId,
      orderStatus: OrderStatus.CONFIRMED,
    };
  }

  async getPaymentByOrderId(orderId: string): Promise<PaymentResponseDto | null> {
    const payment = await this.paymentRepository.findByOrderId(orderId);
    return payment ? PaymentMapper.toResponse(payment) : null;
  }
}
