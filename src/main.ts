import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ClassSerializerInterceptor, ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';
import { Logger } from 'nestjs-pino';
import { env } from './config/env';
import { APP_CONFIG } from './config/app.config';
import helmet from '@fastify/helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Pino Logger
  app.useLogger(app.get(Logger));

  // Security headers — type cast needed due to pnpm resolving @fastify/helmet against fastify@5.8.4 while we run 5.8.5
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(helmet as any, { contentSecurityPolicy: false });

  // CORS
  app.enableCors({
    origin: env.ALLOWED_ORIGIN ?? '*',
    credentials: true,
  });

  // Global prefix and URI versioning
  app.setGlobalPrefix(APP_CONFIG.apiPrefix, { exclude: ['/health'] });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: APP_CONFIG.defaultVersion,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global class serializer (respects @Exclude / @Expose decorators on entities)
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Swagger — dev only
  if (env.NODE_ENV !== 'prod') {
    const config = new DocumentBuilder()
      .setTitle(APP_CONFIG.name)
      .setVersion(APP_CONFIG.version)
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(APP_CONFIG.docsPath, app, document);
  }

  // Prisma shutdown hooks
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  await app.listen(env.PORT ?? 3000);
  app
    .get(Logger)
    .log(`Server running on http://localhost:${env.PORT}`, 'Bootstrap');
}

bootstrap().catch(console.error);
