import { Module, Provider } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@/prisma/prisma.module';
import { PaymentModule } from '@/payment/payment.module';
import { CartModule } from '@/cart/cart.module';
import { MediaModule } from '@/media/media.module';
import { MailerModule } from '@/mailer/mailer.module';
import { isInvoiceWorkerEnabledInApi } from '@/invoice/invoice.module';
import { ORDER_NOTIFICATION_QUEUE } from './queue/order-notification.queue.constants';
import { OrderNotificationService } from './queue/order-notification.service';
import { OrderNotificationProcessor } from './queue/order-notification.processor';
import { OrderRepository } from './order.repository';
import { OrderPricingService } from './order-pricing.service';
import { OrderService } from './order.service';
import { CheckoutController } from './controllers/checkout.controller';
import { OrderController } from './controllers/order.controller';
import { OrderAdminController } from './controllers/order.admin.controller';

const workerProviders: Provider[] = isInvoiceWorkerEnabledInApi()
  ? [OrderNotificationProcessor]
  : [];

@Module({
  imports: [
    PrismaModule,
    PaymentModule,
    CartModule,
    MediaModule,
    MailerModule,
    BullModule.registerQueue({ name: ORDER_NOTIFICATION_QUEUE }),
  ],
  controllers: [CheckoutController, OrderController, OrderAdminController],
  providers: [
    OrderRepository,
    OrderPricingService,
    OrderNotificationService,
    OrderService,
    ...workerProviders,
  ],
  exports: [OrderRepository, OrderPricingService, OrderNotificationService, OrderService],
})
export class OrderModule {}
