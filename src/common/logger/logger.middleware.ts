import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: PinoLogger) {}

  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void) {
    const start = Date.now();
    const { method, url } = req;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;

      const meta = { method, url, statusCode, duration: `${duration}ms` };

      if (statusCode >= 500) {
        this.logger.error(meta, `${method} ${url} → ${statusCode}`);
      } else if (statusCode >= 400) {
        this.logger.warn(meta, `${method} ${url} → ${statusCode}`);
      } else {
        this.logger.info(meta, `${method} ${url} → ${statusCode}`);
      }
    });

    next();
  }
}
