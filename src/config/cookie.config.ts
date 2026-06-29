import { CookieSerializeOptions } from '@fastify/cookie';
import { env } from './env';

export function getCookieOptions(): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'prod',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}
