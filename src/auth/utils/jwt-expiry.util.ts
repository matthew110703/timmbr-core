/**
 * Seconds until a JWT's `exp` (read without verifying — only for sizing TTLs
 * of tokens this service just signed). Keeps Redis entries and cookies tied to
 * JWT_*_EXPIRES_IN, so there is a single source of truth for token lifetimes.
 */
export function secondsUntilJwtExpiry(token: string, now = Date.now()): number {
  const [, payload] = token.split('.');
  const { exp } = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString('utf8') || '{}') as {
    exp?: unknown;
  };
  if (typeof exp !== 'number') throw new Error('JWT has no exp claim');
  return Math.max(1, Math.floor(exp - now / 1000));
}
