import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@/redis/redis.service';
import { RedisCart } from './types/cart.types';
import { getGuestCartRedisKey, getGuestCartTtlSeconds } from './cart.constants';

@Injectable()
export class CartRedisRepository {
  private readonly logger = new Logger(CartRedisRepository.name);

  constructor(private readonly redisService: RedisService) {}

  async getGuestCart(guestCartId: string): Promise<RedisCart | null> {
    const key = getGuestCartRedisKey(guestCartId);
    const data = await this.redisService.get(key);
    if (!data) return null;

    try {
      return JSON.parse(data) as RedisCart;
    } catch (error) {
      this.logger.error(`Failed to parse Redis cart for key ${key}:`, error);
      return null;
    }
  }

  async saveGuestCart(
    guestCartId: string,
    cart: RedisCart,
    ttlSeconds: number = getGuestCartTtlSeconds(),
  ): Promise<void> {
    const key = getGuestCartRedisKey(guestCartId);
    const payload = JSON.stringify(cart);
    await this.redisService.setWithTTL(key, ttlSeconds, payload);
  }

  async deleteGuestCart(guestCartId: string): Promise<void> {
    const key = getGuestCartRedisKey(guestCartId);
    await this.redisService.delete(key);
  }
}
