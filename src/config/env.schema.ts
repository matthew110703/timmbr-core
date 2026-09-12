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
  RESEND_API_KEY: z.string(),
  MAIL_FROM: z.string(),
  APP_BASE_URL: z.string(),
  CLIENT_BASE_URL: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_PUBLIC_URL: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  ORDER_EXPIRATION_TTL_MINUTES: z.coerce.number().default(15),
  CRON_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
