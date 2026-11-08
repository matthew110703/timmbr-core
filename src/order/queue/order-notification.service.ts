import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { MailerService } from '@/mailer/mailer.service';
import { InvoiceEmailStatus } from '@prisma/client';
import { formatOrderNumber } from '../order.helper';
import {
  buildOrderNotificationJobId,
  ORDER_NOTIFICATION_QUEUE,
  OrderNotificationJobPayload,
  SEND_ORDER_NOTIFICATION_JOB,
} from './order-notification.queue.constants';

export const ORDER_NOTIFICATION_MAX_ATTEMPTS = 4;
export const ORDER_NOTIFICATION_BACKOFF_DELAY_MS = 3000;

@Injectable()
export class OrderNotificationService {
  private readonly logger = new Logger(OrderNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailerService: MailerService,
    @InjectQueue(ORDER_NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue<OrderNotificationJobPayload>,
  ) {}

  async enqueueDeliveryJob(orderId: string, deliveryId: string): Promise<void> {
    const jobId = buildOrderNotificationJobId(deliveryId);
    const existingJob = await this.notificationQueue.getJob?.(jobId)?.catch(() => null);
    if (existingJob) {
      const state = await existingJob.getState().catch(() => 'unknown');
      if (state === 'failed' || state === 'completed') {
        await existingJob.remove().catch(() => undefined);
      }
    }

    await this.notificationQueue.add(
      SEND_ORDER_NOTIFICATION_JOB,
      { orderId, deliveryId },
      {
        jobId,
        attempts: ORDER_NOTIFICATION_MAX_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: ORDER_NOTIFICATION_BACKOFF_DELAY_MS,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }

  async processDeliveryJob(params: {
    orderId: string;
    deliveryId: string;
    attemptNumber: number;
    maxAttempts: number;
  }): Promise<void> {
    const delivery = await this.prisma.orderNotificationDelivery.findUnique({
      where: { id: params.deliveryId },
      include: {
        activity: {
          include: {
            order: {
              include: {
                user: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      this.logger.warn(
        { deliveryId: params.deliveryId, orderId: params.orderId },
        'OrderNotificationDelivery record not found, skipping notification job',
      );
      return;
    }

    if (delivery.status === InvoiceEmailStatus.SENT) {
      this.logger.log(
        { deliveryId: delivery.id, orderId: delivery.orderId },
        'OrderNotificationDelivery already marked SENT, skipping duplicate send',
      );
      return;
    }

    const order = delivery.activity.order;
    const shipping = (order.shippingAddress ?? {}) as Record<string, unknown>;
    const customerName =
      order.user?.name ||
      `${(shipping.firstName as string) ?? ''} ${(shipping.lastName as string) ?? ''}`.trim() ||
      'Customer';

    const now = new Date();

    try {
      await this.mailerService.sendOrderUpdateEmail({
        to: delivery.recipient,
        customerName,
        orderNumber: formatOrderNumber(order.id),
        orderStatus: order.status,
        updateCategory: delivery.activity.updateCategory ?? delivery.activity.eventType,
        message: delivery.activity.description,
      });

      await this.prisma.orderNotificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: InvoiceEmailStatus.SENT,
          attempts: { increment: 1 },
          lastAttemptAt: now,
          sentAt: now,
          lastError: null,
        },
      });

      this.logger.log(
        {
          orderId: order.id,
          deliveryId: delivery.id,
          recipient: delivery.recipient,
        },
        'Delivered order update email notification',
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isFinalAttempt = params.attemptNumber >= params.maxAttempts;
      const nextStatus = isFinalAttempt ? InvoiceEmailStatus.FAILED : InvoiceEmailStatus.PENDING;

      await this.prisma.orderNotificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: nextStatus,
          attempts: { increment: 1 },
          lastAttemptAt: now,
          lastError: errorMessage,
        },
      });

      this.logger.error(
        {
          orderId: order.id,
          deliveryId: delivery.id,
          attemptNumber: params.attemptNumber,
          maxAttempts: params.maxAttempts,
          isFinalAttempt,
          err: errorMessage,
        },
        'Order notification delivery attempt failed',
      );

      throw error;
    }
  }
}
