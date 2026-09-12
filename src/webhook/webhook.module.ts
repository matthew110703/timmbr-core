import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { PaymentModule } from '@/payment/payment.module';
import { OrderModule } from '@/order/order.module';
import { WebhookRepository } from './webhook.repository';
import { WebhookService } from './webhook.service';
import { WebhookController } from './controllers/webhook.controller';
import { CronSecretGuard } from './guards/cron-secret.guard';

@Module({
  imports: [PrismaModule, PaymentModule, OrderModule],
  controllers: [WebhookController],
  providers: [WebhookRepository, WebhookService, CronSecretGuard],
  exports: [WebhookRepository, WebhookService],
})
export class WebhookModule {}
