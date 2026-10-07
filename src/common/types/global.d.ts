import type { Logger } from 'nestjs-pino';
import type { Application } from './application.types';

declare global {
  var logger: Logger;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: Record<string, unknown>;
    application?: Application;
    /** Set by the trusted-client hook: request came from the storefront BFF. */
    trustedClient?: boolean;
  }
}
