import z from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['dev', 'prod', 'test']).default('dev'),
  DATABASE_URL: z.string(),
  ALLOWED_ORIGIN: z.string().optional(),
  JWT_ACCESS_SECRET: z.string(),
  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .regex(/^\d+\s*(ms|s|m|h|d|w|y)$/)
    .default('15m'),
  JWT_REFRESH_SECRET: z.string(),
  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .regex(/^\d+\s*(ms|s|m|h|d|w|y)$/)
    .default('7d'),
  COOKIE_SECRET: z.string(),
  REDIS_URL: z.string(),
  REFRESH_TOKEN_TTL: z.coerce.number().default(7 * 24 * 60 * 60),
});

export type Env = z.infer<typeof envSchema>;
