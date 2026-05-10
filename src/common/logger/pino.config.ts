import { Params } from 'nestjs-pino';
import { env } from '@/config/env';
import type { IncomingMessage, ServerResponse } from 'node:http';

const isDev = env.NODE_ENV !== 'prod';

export const pinoConfig: Params = {
  pinoHttp: {
    level: isDev ? 'debug' : 'info',
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat: '[{context}] {msg}',
          },
        }
      : undefined,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.confirmPassword',
        'req.body.token',
        'req.body.refreshToken',
        'res.headers["set-cookie"]',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      req(req: IncomingMessage) {
        return {
          id: (req as IncomingMessage & { id?: string }).id,
          method: req.method,
          url: req.url,
          userAgent: req.headers['user-agent'],
          ip: req.socket?.remoteAddress,
        };
      },
      res(res: ServerResponse<IncomingMessage>) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    genReqId(req: IncomingMessage) {
      return (req.headers['x-request-id'] as string) ?? crypto.randomUUID();
    },
    autoLogging: {
      ignore(req: IncomingMessage) {
        return ['/health', '/metrics', '/favicon.ico'].includes(req.url ?? '');
      },
    },
    customLogLevel(_req: IncomingMessage, res: ServerResponse<IncomingMessage>, err: unknown) {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage(req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
      return `${req.method} ${req.url} -> ${res.statusCode}`;
    },
    customErrorMessage(req: IncomingMessage, res: ServerResponse<IncomingMessage>, err: Error) {
      return `${req.method} ${req.url} -> ${res.statusCode} | ${err.message}`;
    },
  },
};
