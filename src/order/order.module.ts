import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { PaymentModule } from '@/payment/payment.module';
import { CartModule } from '@/cart/cart.module';
import { MediaModule } from '@/media/media.module';
import { OrderRepository } from './order.repository';
import { OrderPricingService } from './order-pricing.service';
import { OrderService } from './order.service';
import { CheckoutController } from './controllers/checkout.controller';
import { OrderController } from './controllers/order.controller';
import { OrderAdminController } from './controllers/order.admin.controller';

@Module({
  imports: [PrismaModule, PaymentModule, CartModule, MediaModule],
  controllers: [CheckoutController, OrderController, OrderAdminController],
  providers: [OrderRepository, OrderPricingService, OrderService],
  exports: [OrderRepository, OrderPricingService, OrderService],
})
export class OrderModule {}
