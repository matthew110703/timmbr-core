import z from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['dev', 'prod']).default('dev'),
  DATABASE_URL: z.string(),
  ALLOWED_ORIGIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
