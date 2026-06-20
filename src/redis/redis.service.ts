import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS_CLIENT') private readonly client: Redis) {}

  setWithTTL(key: string, ttlSeconds: number, value: string) {
    return this.client.setex(key, ttlSeconds, value);
  }

  getAndDelete(key: string) {
    return this.client.getdel(key);
  }

  delete(key: string) {
    return this.client.del(key);
  }
}
