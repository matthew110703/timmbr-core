import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RazorpayService } from '@/payment/razorpay.service';
import { PaymentRepository } from '@/payment/payment.repository';
import { WebhookRepository } from './webhook.repository';
import { InventoryTransactionType, OrderStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly paymentRepository: PaymentRepository,
    private readonly webhookRepository: WebhookRepository,
  ) {}

  async handleRazorpayWebhook(
    rawBody: string,
    signature: string,
    payload: any,
  ): Promise<{ received: boolean; idempotent?: boolean }> {
    // 1. Verify Razorpay webhook signature
    this.razorpayService.verifyWebhookSignature(rawBody, signature);

    const eventId = payload?.id || payload?.event_id || `evt_${Date.now()}`;
    const eventType = payload?.event || 'unknown';

    // 2. Check idempotency
    const existing = await this.webhookRepository.findEvent('RAZORPAY', eventId);
    if (existing && existing.processedAt) {
      this.logger.log(`Webhook event ${eventId} [${eventType}] has already been processed.`);
      return { received: true, idempotent: true };
    }

    this.logger.log(`Processing Razorpay webhook event ${eventId} [${eventType}]`);

    // 3. Process supported events
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = payload?.payload?.payment?.entity;
      const providerOrderId = paymentEntity?.order_id || payload?.payload?.order?.entity?.id;
      const providerPaymentId = paymentEntity?.id;

      if (providerOrderId) {
        const payment = await this.paymentRepository.findByProviderOrderId(providerOrderId);
        if (payment && payment.status !== PaymentStatus.PAID) {
          await this.prisma.$transaction(async (tx) => {
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: PaymentStatus.PAID,
                ...(providerPaymentId && { providerPaymentId }),
              },
            });

            const order = await tx.order.findUnique({
              where: { id: payment.orderId },
              include: { items: true },
            });

            if (order && order.status === OrderStatus.PENDING) {
              // Concurrency-guarded update: only confirm if still PENDING.
              // Prevents race condition with the cleanup cron that may
              // cancel this order between our findUnique and update.
              const updateResult = await tx.order.updateMany({
                where: { id: order.id, status: OrderStatus.PENDING },
                data: {
                  status: OrderStatus.CONFIRMED,
                  placedAt: new Date(),
                  expiresAt: null,
                },
              });

              if (updateResult.count === 0) {
                this.logger.warn(
                  `Order ${order.id} was no longer PENDING when payment arrived — skipping confirmation.`,
                );
                return;
              }

              for (const item of order.items) {
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
                        referenceId: order.id,
                        reason: `Order #${order.id.substring(0, 8)} paid via webhook`,
                      },
                    });
                  }
                }
              }
            }
          });
        }
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = payload?.payload?.payment?.entity;
      const providerOrderId = paymentEntity?.order_id;
      const providerPaymentId = paymentEntity?.id;

      if (providerOrderId) {
        const payment = await this.paymentRepository.findByProviderOrderId(providerOrderId);
        if (payment && payment.status === PaymentStatus.PENDING) {
          await this.paymentRepository.update(payment.id, {
            status: PaymentStatus.FAILED,
            ...(providerPaymentId && { providerPaymentId }),
          });
        }
      }
    }

    // 4. Save WebhookEvent for idempotency
    await this.webhookRepository.recordEvent({
      provider: 'RAZORPAY',
      eventId,
      eventType,
      payload,
      processedAt: new Date(),
    });

    return { received: true };
  }
}
