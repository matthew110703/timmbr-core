import { Params } from 'nestjs-pino';
import { env } from '@/config/env';
import type { IncomingMessage, ServerResponse } from 'node:http';
import PinoPretty from 'pino-pretty';

const isProd = env.NODE_ENV === 'prod';
const usePretty = env.LOG_FORMAT ? env.LOG_FORMAT === 'pretty' : !isProd;

const MAX_BODY_LEN = 500;

type ExtendedRequest = IncomingMessage & {
  id?: string;
  user?: { id?: string; sub?: string };
  raw?: { user?: { id?: string; sub?: string } };
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  __resBody?: string;
};

/** Response bodies are logged as raw strings, so path-based redaction can't reach them. */
const SECRET_RES_FIELDS = /("(?:accessToken|refreshToken|passwordSetupToken)"\s*:\s*")[^"]*"/g;

function redactResBody(s: string): string {
  return s.replace(SECRET_RES_FIELDS, '$1[Redacted]"');
}

function truncate(s: string): string {
  if (s.length <= MAX_BODY_LEN) return s;
  return s.slice(0, MAX_BODY_LEN) + `… (+${s.length - MAX_BODY_LEN} chars)`;
}

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  // Passwords & credentials
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.confirmPassword',
  // Tokens & secrets
  'req.body.token',
  'req.body.refreshToken',
  'req.body.accessToken',
  'req.body.secret',
  'req.body.clientSecret',
  'req.body.apiKey',
  'req.body.otp',
  'req.body.code',
  // Financial & payment data
  'req.body.cardNumber',
  'req.body.card_number',
  'req.body.cvv',
  'req.body.pan',
  'req.body.expiry',
  // Wildcards for nested payload protection
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.confirmPassword',
  '*.token',
  '*.refreshToken',
  '*.accessToken',
  '*.secret',
  '*.clientSecret',
  '*.apiKey',
  '*.cvv',
  '*.cardNumber',
  '*.pan',
];

const devSerializers = {
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
};

const prodSerializers = {
  req: () => undefined,
  res: () => undefined,
};

const sharedOptions = {
  base: undefined,
  messageKey: 'message',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level: (label: string) => ({ level: label.toUpperCase() }),
  },
  customAttributeKeys: {
    reqId: 'requestId',
    responseTime: 'durationMs',
  },
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
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
  customSuccessMessage() {
    return 'http_request_completed';
  },
  customErrorMessage(_req: IncomingMessage, _res: ServerResponse<IncomingMessage>, err: Error) {
    return err?.name ? err.name.toLowerCase() : 'http_request_failed';
  },
  customSuccessObject(
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>,
    val: Record<string, unknown>,
  ) {
    const ext = req as ExtendedRequest;
    const user = ext.user ?? ext.raw?.user;
    const userId = user?.id ?? user?.sub;

    return {
      ...val,
      requestId: ext.id,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ...(userId ? { userId } : {}),
      ...(usePretty && ext.__resBody ? { resBody: truncate(redactResBody(ext.__resBody)) } : {}),
    };
  },
  customErrorObject(
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>,
    err: Error,
    val: Record<string, unknown>,
  ) {
    const ext = req as ExtendedRequest;
    const user = ext.user ?? ext.raw?.user;
    const userId = user?.id ?? user?.sub;

    return {
      ...val,
      requestId: ext.id,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ...(userId ? { userId } : {}),
      stack: err?.stack,
    };
  },
};

const devStream = PinoPretty({
  colorize: true,
  translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
  ignore: 'pid,hostname,req,res,responseTime,durationMs,resBody,context',
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
    const method =
      (log.method as string) ?? (log.req as Record<string, unknown> | undefined)?.method;
    const url = (log.url as string) ?? (log.req as Record<string, unknown> | undefined)?.url;
    const status =
      (log.status as number) ?? (log.res as Record<string, unknown> | undefined)?.statusCode;
    const duration = log.durationMs ?? log.responseTime;
    const req = log.req as Record<string, unknown> | undefined;

    if (method && duration !== undefined) {
      const rt = typeof duration === 'number' ? duration : '?';
      const statusStr = status !== undefined ? ` -> ${status}` : '';
      const lines: string[] = [colors.bold(`${method} ${url}${statusStr} | ${rt}ms`)];

      if (req?.body !== null && typeof req?.body === 'object' && Object.keys(req.body).length)
        lines.push(colors.cyan(`  [body]   ${JSON.stringify(req.body)}`));
      if (req?.query !== null && typeof req?.query === 'object' && Object.keys(req.query).length)
        lines.push(colors.yellow(`  [query]  ${JSON.stringify(req.query)}`));
      if (req?.params !== null && typeof req?.params === 'object' && Object.keys(req.params).length)
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
  pinoHttp: usePretty
    ? ([
        {
          level: 'debug',
          ...sharedOptions,
          serializers: devSerializers,
        },
        devStream,
      ] as Params['pinoHttp'])
    : {
        level: 'info',
        ...sharedOptions,
        serializers: prodSerializers,
      },
};
