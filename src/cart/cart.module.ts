import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { RedisModule } from '@/redis/redis.module';
import { MediaModule } from '@/media/media.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartRepository } from './cart.repository';
import { CartRedisRepository } from './cart-redis.repository';
import { CartPricingSync } from './cart.pricing-sync';

@Module({
  imports: [PrismaModule, RedisModule, MediaModule],
  controllers: [CartController],
  providers: [CartService, CartRepository, CartRedisRepository, CartPricingSync],
  exports: [CartService, CartRepository],
})
export class CartModule {}
