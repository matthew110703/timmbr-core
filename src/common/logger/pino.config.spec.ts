import { pinoConfig } from './pino.config';
import type { IncomingMessage, ServerResponse } from 'node:http';

describe('pinoConfig', () => {
  it('should be defined and configure pinoHttp', () => {
    expect(pinoConfig).toBeDefined();
    expect(pinoConfig.pinoHttp).toBeDefined();
  });

  it('should have customSuccessMessage returning http_request_completed', () => {
    const opts = Array.isArray(pinoConfig.pinoHttp) ? pinoConfig.pinoHttp[0] : pinoConfig.pinoHttp;

    expect(opts).toBeDefined();
    if (typeof opts === 'object' && opts !== null && 'customSuccessMessage' in opts) {
      const msgFn = opts.customSuccessMessage as (
        req: IncomingMessage,
        res: ServerResponse,
      ) => string;
      expect(msgFn({} as IncomingMessage, {} as ServerResponse)).toBe('http_request_completed');
    }
  });

  it('should have customLogLevel returning error for 500, warn for 400, info for 200', () => {
    const opts = Array.isArray(pinoConfig.pinoHttp) ? pinoConfig.pinoHttp[0] : pinoConfig.pinoHttp;

    if (typeof opts === 'object' && opts !== null && 'customLogLevel' in opts) {
      const levelFn = opts.customLogLevel as (
        req: IncomingMessage,
        res: ServerResponse,
        err: unknown,
      ) => string;

      expect(levelFn({} as IncomingMessage, { statusCode: 500 } as ServerResponse, null)).toBe(
        'error',
      );
      expect(
        levelFn({} as IncomingMessage, { statusCode: 200 } as ServerResponse, new Error()),
      ).toBe('error');
      expect(levelFn({} as IncomingMessage, { statusCode: 404 } as ServerResponse, null)).toBe(
        'warn',
      );
      expect(levelFn({} as IncomingMessage, { statusCode: 200 } as ServerResponse, null)).toBe(
        'info',
      );
    }
  });

  it('should configure customAttributeKeys for requestId and durationMs', () => {
    const opts = Array.isArray(pinoConfig.pinoHttp) ? pinoConfig.pinoHttp[0] : pinoConfig.pinoHttp;

    if (typeof opts === 'object' && opts !== null && 'customAttributeKeys' in opts) {
      expect(opts.customAttributeKeys).toEqual({
        reqId: 'requestId',
        responseTime: 'durationMs',
      });
    }
  });

  describe('customSuccessObject (response body logging)', () => {
    const successObject = () => {
      const opts = Array.isArray(pinoConfig.pinoHttp)
        ? pinoConfig.pinoHttp[0]
        : pinoConfig.pinoHttp;
      return (opts as { customSuccessObject: (...args: unknown[]) => Record<string, unknown> })
        .customSuccessObject;
    };
    const res = { statusCode: 200 } as ServerResponse;
    const log = (body: unknown) =>
      successObject()({ id: 'r1', method: 'GET', url: '/x', __resBody: body }, res, {});

    it('does not throw for a response that is not text (a file served as a buffer or stream)', () => {
      expect(() => log(Buffer.from('console.log(1)'))).not.toThrow();
      expect(() => log({ pipe: () => undefined })).not.toThrow();
      expect(log(Buffer.from('x'))).not.toHaveProperty('resBody');
    });

    it('logs a text body, with tokens redacted and long bodies cut', () => {
      const secret = log('{"accessToken":"abc123","ok":true}');
      expect(secret.resBody).toContain('[Redacted]');
      expect(secret.resBody).not.toContain('abc123');

      expect(String(log('a'.repeat(900)).resBody)).toContain('(+400 chars)');
    });

    it('logs nothing for an empty body', () => {
      expect(log('')).not.toHaveProperty('resBody');
      expect(log(undefined)).not.toHaveProperty('resBody');
    });
  });
});
