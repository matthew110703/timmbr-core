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
import { env, parseOrigins } from './config/env';
import { APP_CONFIG } from './config/app.config';
import helmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import { registerRawBodyHook } from './common/hooks/raw-body.hook';
import { registerTrustedClientHook } from './common/trusted-client';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter({
    // Behind a load balancer the client IP is in X-Forwarded-For; rate limits
    // (throttler, OTP) need the real IP rather than the proxy's.
    trustProxy: env.TRUST_PROXY > 0 ? env.TRUST_PROXY : false,
    requestIdHeader: 'x-request-id',
    genReqId: (req) => (req.headers['x-request-id'] as string) ?? crypto.randomUUID(),
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, fastifyAdapter);

  // Pino Logger
  app.useLogger(app.get(Logger));
  global.logger = app.get(Logger);

  const fastifyInstance = app.getHttpAdapter().getInstance();

  // Preserve raw request body for webhook signature verification
  registerRawBodyHook(fastifyInstance);

  // Identify the storefront BFF (server-to-server) before guards run
  registerTrustedClientHook(fastifyInstance);

  // Propagate correlation ID on response headers immediately
  fastifyInstance.addHook('onRequest', (request, reply, done) => {
    reply.header('x-request-id', request.id);
    done();
  });

  // Capture response body for structured logging and ensure header is retained
  fastifyInstance.addHook('onSend', (request, reply, payload: string, done) => {
    reply.header('x-request-id', request.id);
    (request.raw as { __resBody?: string }).__resBody = payload;
    done(null, payload);
  });

  // Security headers — type cast needed due to pnpm resolving @fastify/helmet against fastify@5.8.4 while we run 5.8.5
  await app.register(helmet as any, { contentSecurityPolicy: false });

  // Cookies
  await app.register(fastifyCookie as any, {
    secret: env.COOKIE_SECRET,
  });

  // CORS — synchronized with centralized application origin settings
  const corsOrigins = Array.from(
    new Set([
      ...parseOrigins(env.STOREFRONT_ORIGIN),
      ...parseOrigins(env.ADMIN_CONSOLE_ORIGIN),
      ...parseOrigins(env.ALLOWED_ORIGIN),
    ]),
  );

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : '*',
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
      'sec-ch-ua',
      'sec-ch-ua-mobile',
      'sec-ch-ua-platform',
      'x-request-id',
      'X-Request-Id',
    ],
    exposedHeaders: ['x-request-id', 'X-Request-Id'],
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

  const port = env.PORT ?? 8001;
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`Server running on http://localhost:${env.PORT}`, 'Bootstrap');
}

bootstrap().catch(console.error);
