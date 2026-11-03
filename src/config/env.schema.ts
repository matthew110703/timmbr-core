import z from 'zod';

/** Official 15-character Indian GSTIN format. */
export const INDIAN_GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** GST Rule 46(b): prefix must be 1-3 uppercase alphanumeric chars so PREFIX/YY-YY/000001 <= 16 chars. */
export const INVOICE_PREFIX_REGEX = /^[A-Z0-9]{1,3}$/;

const REQUIRED_PROD_SELLER_FIELDS = [
  'INVOICE_SELLER_NAME',
  'INVOICE_SELLER_GSTIN',
  'INVOICE_SELLER_ADDRESS',
  'INVOICE_SELLER_PHONE',
  'INVOICE_SELLER_EMAIL',
] as const;

export const envSchema = z
  .object({
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

    // Email transport configuration: 'smtp' (e.g. Mailpit in dev) or 'resend' (prod)
    MAIL_TRANSPORT: z.enum(['smtp', 'resend']).default('smtp'),
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().default(1025),
    SMTP_SECURE: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),

    RESEND_API_KEY: z.string().optional(),
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
    // Reverse geocoding for "use my location" on address forms. Unset = 503.
    GEOAPIFY_API_KEY: z.string().optional(),
    ORDER_EXPIRATION_TTL_MINUTES: z.coerce.number().default(15),
    GUEST_CART_TTL_DAYS: z.coerce.number().default(7),
    CACHE_TTL_SECONDS: z.coerce.number().default(120),
    CRON_SECRET: z.string().optional(),
    LOG_FORMAT: z.enum(['json', 'pretty']).optional(),
    // Shared secret for the storefront BFF (server-to-server). Unset = trusted mode off.
    CORE_INTERNAL_KEY: z.string().min(32).optional(),
    // Number of trusted proxy hops in front of the API (0 = direct).
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    // Invoice & Seller GST configuration (required in prod; no sample business defaults)
    INVOICE_SELLER_NAME: z.string().min(1).optional(),
    INVOICE_SELLER_GSTIN: z
      .string()
      .regex(INDIAN_GSTIN_REGEX, 'INVOICE_SELLER_GSTIN must be a valid 15-character Indian GSTIN')
      .optional(),
    INVOICE_SELLER_ADDRESS: z.string().min(1).optional(),
    INVOICE_SELLER_PHONE: z.string().min(1).optional(),
    INVOICE_SELLER_EMAIL: z.string().email().optional(),

    // Optional operational flags with sensible defaults
    INVOICE_NUMBER_PREFIX: z
      .string()
      .regex(
        INVOICE_PREFIX_REGEX,
        'INVOICE_NUMBER_PREFIX must be 1-3 uppercase alphanumeric characters (GST Rule 46 <=16 char limit)',
      )
      .default('INV'),
    // Production validation gate for HSN codes (defaults to true in prod, false otherwise)
    INVOICE_REQUIRE_HSN: z.enum(['true', 'false']).optional(),
    // Run outbox + BullMQ workers inside the API process (defaults to false in prod, true in dev)
    INVOICE_WORKER_IN_API: z.enum(['true', 'false']).optional(),
    INVOICE_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  })
  .superRefine((data, ctx) => {
    if (data.MAIL_TRANSPORT === 'resend' || data.NODE_ENV === 'prod') {
      if (!data.RESEND_API_KEY || data.RESEND_API_KEY.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RESEND_API_KEY'],
          message: 'RESEND_API_KEY is required when MAIL_TRANSPORT is "resend" or in production.',
        });
      }
    }

    if (data.NODE_ENV === 'prod') {
      for (const field of REQUIRED_PROD_SELLER_FIELDS) {
        if (!data[field] || String(data[field]).trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} is required in production.`,
          });
        }
      }
    }

    if (data.INVOICE_SELLER_GSTIN) {
      const stateCodeNum = Number(data.INVOICE_SELLER_GSTIN.slice(0, 2));
      if (Number.isNaN(stateCodeNum) || stateCodeNum < 1 || stateCodeNum > 38) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['INVOICE_SELLER_GSTIN'],
          message: `First two digits of INVOICE_SELLER_GSTIN must be a valid 2-digit Indian GST state code (01-38).`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;
