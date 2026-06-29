import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS_CLIENT') private readonly client: Redis) {}

  setWithTTL(key: string, ttlSeconds: number, value: string) {
    return this.client.setex(key, ttlSeconds, value);
  }

  get(key: string) {
    return this.client.get(key);
  }

  getAndDelete(key: string) {
    return this.client.getdel(key);
  }

  delete(key: string) {
    return this.client.del(key);
  }

  async incrementWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return count;
  }
}
