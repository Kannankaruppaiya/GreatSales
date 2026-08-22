import { z } from 'zod';

/**
 * Environment contract. Validated once at boot via ConfigModule so a
 * misconfigured deploy fails fast with a readable error instead of surfacing
 * as a runtime NPE deep in a request.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Runtime connection = greatsales_app (RLS-bound).
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  CORS_ORIGIN: z.string().default('*'),
});

export type Env = z.infer<typeof envSchema>;

/** ConfigModule `validate` hook — throws on invalid env, returns typed config. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${JSON.stringify(parsed.error.format(), null, 2)}`,
    );
  }
  return parsed.data;
}
