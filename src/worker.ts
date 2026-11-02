import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { InvoiceWorkerModule } from './invoice/worker.module';

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(InvoiceWorkerModule, {
    bufferLogs: true,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  // Run onModuleDestroy / onApplicationShutdown hooks (Outbox, BullMQ, Playwright, Prisma, Redis) on SIGTERM / SIGINT
  app.enableShutdownHooks();

  logger.log(
    'Invoice background worker (Outbox Dispatcher + PDF & Email BullMQ Processors) started',
    'InvoiceWorker',
  );
}

bootstrapWorker().catch((err) => {
  console.error('Failed to start InvoiceWorker:', err);
  process.exit(1);
});
