import { CookieSerializeOptions } from '@fastify/cookie';
import { env } from '@/config/env';

export const CART_CONSTANTS = {
  GUEST_CART_COOKIE: 'timmbr_guest_cart',
  REDIS_KEY_PREFIX: 'cart:guest:',
  DEFAULT_CURRENCY: 'INR',
} as const;

export function getGuestCartTtlSeconds(): number {
  return (env.GUEST_CART_TTL_DAYS ?? 7) * 24 * 60 * 60;
}

export function getGuestCartRedisKey(guestCartId: string): string {
  return `${CART_CONSTANTS.REDIS_KEY_PREFIX}${guestCartId}`;
}

export function getGuestCartCookieOptions(): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'prod',
    sameSite: 'lax',
    path: '/',
    maxAge: getGuestCartTtlSeconds(),
  };
}
