import { Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { env } from '@/config/env';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => new Redis(env.REDIS_URL),
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
