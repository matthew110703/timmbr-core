import { Params } from 'nestjs-pino';
import { env } from '@/config/env';
import type { IncomingMessage, ServerResponse } from 'node:http';
import PinoPretty from 'pino-pretty';

const isDev = env.NODE_ENV !== 'prod';

const MAX_BODY_LEN = 500;

type ExtendedRequest = IncomingMessage & {
  id?: string;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  __resBody?: string;
};

function truncate(s: string): string {
  if (s.length <= MAX_BODY_LEN) return s;
  return s.slice(0, MAX_BODY_LEN) + `… (+${s.length - MAX_BODY_LEN} chars)`;
}

const sharedOptions = {
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
      const r = req as ExtendedRequest;
      return {
        id: r.id,
        method: r.method,
        url: r.url,
        userAgent: r.headers['user-agent'],
        ip: r.socket?.remoteAddress,
        body: r.body,
        query: r.query,
        params: r.params,
      };
    },
    res(res: ServerResponse<IncomingMessage>) {
      return { statusCode: res.statusCode };
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
  customSuccessObject(
    req: IncomingMessage,
    _res: ServerResponse<IncomingMessage>,
    val: Record<string, unknown>,
  ) {
    const raw = (req as ExtendedRequest).__resBody;
    if (!raw) return val;
    return { ...val, resBody: truncate(raw) };
  },
};

const devStream = PinoPretty({
  colorize: true,
  translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
  ignore: 'pid,hostname,req,res,responseTime,resBody,context',
  errorLikeObjectKeys: ['err'],
  messageFormat: (
    log: Record<string, unknown>,
    messageKey: string,
    _levelLabel: string,
    {
      colors,
    }: {
      colors: {
        bold: (s: string) => string;
        cyan: (s: string) => string;
        yellow: (s: string) => string;
        magenta: (s: string) => string;
        green: (s: string) => string;
      };
    },
  ) => {
    const msgValue = log[messageKey];
    const msg = typeof msgValue === 'string' ? msgValue : '';
    const req = log.req as Record<string, unknown> | undefined;

    if (req?.method && log.responseTime !== undefined) {
      const rt = typeof log.responseTime === 'number' ? log.responseTime : '?';
      const lines: string[] = [colors.bold(`${msg} | ${rt}ms`)];

      if (req.body !== null && typeof req.body === 'object' && Object.keys(req.body).length)
        lines.push(colors.cyan(`  [body]   ${JSON.stringify(req.body)}`));
      if (req.query !== null && typeof req.query === 'object' && Object.keys(req.query).length)
        lines.push(colors.yellow(`  [query]  ${JSON.stringify(req.query)}`));
      if (req.params !== null && typeof req.params === 'object' && Object.keys(req.params).length)
        lines.push(colors.magenta(`  [params] ${JSON.stringify(req.params)}`));

      const resBody = typeof log.resBody === 'string' ? log.resBody : undefined;
      if (resBody) lines.push(colors.green(`  [res]    ${resBody}`));

      return lines.join('\n');
    }

    const context = typeof log.context === 'string' ? log.context : undefined;
    return context ? `[${context}] ${msg}` : msg;
  },
});

export const pinoConfig: Params = {
  pinoHttp: isDev
    ? ([{ level: 'debug', ...sharedOptions }, devStream] as Params['pinoHttp'])
    : { level: 'info', ...sharedOptions },
};
