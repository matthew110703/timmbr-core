import type { Logger } from 'nestjs-pino';

declare global {
  var logger: Logger;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: Record<string, unknown>;
  }
}
