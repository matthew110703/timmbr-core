import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  BadRequestException,
  ClassSerializerInterceptor,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { setupSwagger } from './config/swagger.config';
import { PrismaService } from './prisma/prisma.service';
import { Logger } from 'nestjs-pino';
import { env } from './config/env';
import { APP_CONFIG } from './config/app.config';
import helmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  // Pino Logger
  app.useLogger(app.get(Logger));
  global.logger = app.get(Logger);

  // Capture response body for structured logging (attached to req.raw.__resBody)
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', (request, _reply, payload: string, done) => {
      (request.raw as { __resBody?: string }).__resBody = payload;
      done(null, payload);
    });

  // Security headers — type cast needed due to pnpm resolving @fastify/helmet against fastify@5.8.4 while we run 5.8.5
  await app.register(helmet as any, { contentSecurityPolicy: false });

  // Cookies
  await app.register(fastifyCookie as any, {
    secret: env.COOKIE_SECRET,
  });

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
      exceptionFactory: (validationErrors) => {
        const errors = validationErrors.map((e) => ({
          field: e.property,
          errors: Object.values(e.constraints ?? {}),
        }));
        return new BadRequestException({ message: 'Validation failed', errors });
      },
    }),
  );

  // TransformInterceptor first = outermost: wraps the already-serialized result from ClassSerializer
  app.useGlobalInterceptors(
    new TransformInterceptor(app.get(Reflector)),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  // Swagger — dev only, see src/config/swagger.config.ts
  setupSwagger(app);

  // Prisma shutdown hooks
  const prismaService = app.get(PrismaService);
  prismaService.enableShutdownHooks(app);

  await app.listen(env.PORT ?? 3000);
  app.get(Logger).log(`Server running on http://localhost:${env.PORT}`, 'Bootstrap');
}

bootstrap().catch(console.error);
