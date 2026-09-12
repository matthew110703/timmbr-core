import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Imports
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './common/logger/logger.module';
import { GlobalExceptionFilter } from './common/filters';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AccessTokenGuard } from './auth/guards/access-token.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { RedisModule } from './redis/redis.module';
import { MailerModule } from './mailer/mailer.module';
import { UserModule } from './user/user.module';
import { AddressModule } from './address/address.module';
import { AdminModule } from './admin/admin.module';
import { CategoryModule } from './category/category.module';
import { BrandModule } from './brand/brand.module';
import { ProductModule } from './product/product.module';
import { MediaModule } from './media/media.module';
import { InventoryModule } from './inventory/inventory.module';
import { PaymentModule } from './payment/payment.module';
import { OrderModule } from './order/order.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    LoggerModule,
    HealthModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    RedisModule,
    MailerModule,
    AuthModule,
    UserModule,
    AddressModule,
    AdminModule,
    CategoryModule,
    BrandModule,
    ProductModule,
    MediaModule,
    InventoryModule,
    PaymentModule,
    OrderModule,
    WebhookModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
