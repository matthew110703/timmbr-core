import 'dotenv/config';
import { envSchema } from './env.schema';

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables: ', parsed.error.flatten().fieldErrors);

  throw new Error('Invalid environment variables.');
}

export const env = parsed.data;

/** Entries of a comma-separated origin list, trimmed, without trailing slashes. */
export function parseOrigins(list?: string): string[] {
  return (list ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/**
 * Public URLs of the two client apps, derived from their CORS origins (the
 * first entry of each list), so every URL is configured exactly once.
 */
export const appUrls = {
  /** OAuth popups land on `${storefront}/oauth/callback`. */
  storefront: parseOrigins(env.STOREFRONT_ORIGIN)[0] ?? 'http://localhost:3000',
  /** Password-reset emails link to `${adminConsole}/reset-password`. */
  adminConsole: parseOrigins(env.ADMIN_CONSOLE_ORIGIN)[0] ?? 'http://localhost:5000',
};
