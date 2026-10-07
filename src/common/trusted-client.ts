import * as crypto from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { env } from '@/config/env';

/**
 * Trusted server clients (the storefront's Next.js BFF) authenticate with a
 * shared key. For them the API returns tokens in the response body (the BFF
 * keeps them in its own httpOnly cookies) and honours the forwarded client IP
 * for rate limiting. Browsers never have the key.
 */
export const INTERNAL_KEY_HEADER = 'x-internal-key';
export const CLIENT_IP_HEADER = 'x-timmbr-client-ip';

export function isTrustedClientKey(provided: unknown): boolean {
  const expected = env.CORE_INTERNAL_KEY;
  if (!expected || typeof provided !== 'string') return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Structural type: avoids clashes between the two Fastify copies pnpm resolves. */
export interface FastifyOnRequestHookTarget {
  addHook(name: string, hook: (request: any, reply: any, done: () => void) => void): any;
}

/** Flags `request.trustedClient` before any guard, strategy or interceptor runs. */
export function registerTrustedClientHook(fastify: FastifyOnRequestHookTarget) {
  fastify.addHook('onRequest', (request: FastifyRequest, _reply: unknown, done: () => void) => {
    request.trustedClient = isTrustedClientKey(request.headers[INTERNAL_KEY_HEADER]);
    done();
  });
}

/** The end user's IP: forwarded by a trusted client, otherwise the socket/proxy IP. */
export function clientIp(request: FastifyRequest): string {
  const forwarded = request.headers[CLIENT_IP_HEADER];
  if (request.trustedClient && typeof forwarded === 'string' && forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.ip;
}
