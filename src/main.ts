import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { PrismaService } from './prisma/prisma.service';
import { Logger } from 'nestjs-pino';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Pino Logger
  app.useLogger(app.get(Logger));

  // Prisma shutdown hooks
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  await app.listen(env.PORT ?? 3000);
  app
    .get(Logger)
    .log(`Server running on http://localhost:${env.PORT}', 'Bootstrap`);
}
bootstrap();
