import z from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(['dev', 'prod', 'test']).default('dev'),
  DATABASE_URL: z.string(),
  // Comma-separated origins. The first one is also the app's public URL
  // (storefront: OAuth popup landing; admin console: password-reset links).
  STOREFRONT_ORIGIN: z.string().default('http://localhost:3000'),
  ADMIN_CONSOLE_ORIGIN: z.string().default('http://localhost:5000'),
  // Extra CORS origins beyond the two apps above (optional).
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
  RESEND_API_KEY: z.string(),
  MAIL_FROM: z.string(),
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
  GUEST_CART_TTL_DAYS: z.coerce.number().default(7),
  CACHE_TTL_SECONDS: z.coerce.number().default(120),
  CRON_SECRET: z.string().optional(),
  LOG_FORMAT: z.enum(['json', 'pretty']).optional(),
  // Shared secret for the storefront BFF (server-to-server). Unset = trusted mode off.
  CORE_INTERNAL_KEY: z.string().min(32).optional(),
  // Number of trusted proxy hops in front of the API (0 = direct).
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

export type Env = z.infer<typeof envSchema>;
