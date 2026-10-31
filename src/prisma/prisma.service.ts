import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { env } from '@/config/env';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  /** Runs on SIGTERM/SIGINT via `app.enableShutdownHooks()` in main.ts. */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
