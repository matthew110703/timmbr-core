import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  ORDER_NOTIFICATION_QUEUE,
  OrderNotificationJobPayload,
} from './order-notification.queue.constants';
import {
  ORDER_NOTIFICATION_MAX_ATTEMPTS,
  OrderNotificationService,
} from './order-notification.service';

@Processor(ORDER_NOTIFICATION_QUEUE, { concurrency: 5 })
export class OrderNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderNotificationProcessor.name);

  constructor(private readonly orderNotificationService: OrderNotificationService) {
    super();
  }

  async process(job: Job<OrderNotificationJobPayload>): Promise<void> {
    const { orderId, deliveryId } = job.data;
    const attemptNumber = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? ORDER_NOTIFICATION_MAX_ATTEMPTS;

    this.logger.log(
      { jobId: job.id, orderId, deliveryId, attemptNumber, maxAttempts },
      'Processing order notification delivery job',
    );

    await this.orderNotificationService.processDeliveryJob({
      orderId,
      deliveryId,
      attemptNumber,
      maxAttempts,
    });
  }
}
