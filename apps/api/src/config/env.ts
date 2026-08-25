import { z } from 'zod';

/**
 * Environment contract. Validated once at boot via ConfigModule so a
 * misconfigured deploy fails fast with a readable error instead of surfacing
 * as a runtime NPE deep in a request.
 *
 * This schema is the SINGLE SOURCE OF TRUTH for the API's configuration. If a
 * variable is not declared here, the API must not read it — `.env.example`,
 * `.env.staging.example`, `.env.production.example`, and the deployment
 * templates are all generated against this list, and `pnpm env:check`
 * validates a candidate file without booting the app.
 *
 * The base shape is permissive enough for a developer laptop. Everything that
 * would be dangerous in production is enforced by `productionRules` below,
 * which runs only when NODE_ENV=production — so dev stays frictionless while
 * a production deploy cannot start misconfigured.
 */

/** Minimum entropy for a signing secret, in characters. */
const SECRET_MIN = 32;

const booleanish = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((v) => v === 'true');

/**
 * The base shape, before the production-only rules are layered on. Kept
 * separate so its inferred type can be named and handed to `productionRules`
 * without a circular reference back through `envSchema`.
 */
const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  /**
   * Runtime connection = greatsales_app, the RLS-BOUND role. This must never
   * be an owner/superuser URL: such a role silently bypasses every RLS
   * policy and the API would serve cross-tenant data. PrismaService refuses
   * to start if the connected role turns out to be superuser or to carry
   * BYPASSRLS — this variable is the first line of that defence, the boot
   * check is the second.
   */
  DATABASE_URL: z.string().url(),

  /**
   * Owner/migration connection, used by the Prisma CLI (migrate/seed) — NOT
   * by the running API. Optional here because the API process does not need
   * it; the migration job does.
   */
  DIRECT_URL: z.string().url().optional(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  /**
   * Exact allowed browser origins, comma-separated. Credentialed CORS
   * forbids a wildcard — a browser rejects `Access-Control-Allow-Origin: *`
   * when credentials are included — so "*" is a development-only
   * convenience and is refused outright in production.
   */
  CORS_ORIGIN: z.string().default('*'),

  /**
   * Origin SUFFIX allow-list for subdomain-per-tenant deployments, e.g.
   * ".app.greatsales.io". Any `https://` origin ending with this suffix is
   * accepted. Tenants are addressed as `<tenant>.app.greatsales.io`, so the
   * exact origin list cannot be enumerated ahead of time; this is how a new
   * tenant works without a redeploy. Leave empty to allow only CORS_ORIGIN.
   */
  CORS_ORIGIN_SUFFIX: z.string().default(''),

  /**
   * The domain tenants are subdomains of, e.g. "app.greatsales.io". The API
   * resolves the tenant from the request Host by stripping this suffix, so
   * a user never types a tenant id (see FEATURE-ROADMAP F1/D9). Empty means
   * subdomain tenancy is off and the tenant is resolved some other way.
   */
  APP_BASE_DOMAIN: z.string().default(''),

  /**
   * Express `trust proxy` setting. MUST be set when the API runs behind a
   * reverse proxy or load balancer. Left false, `req.ip` is the proxy's
   * address, so every client shares one rate-limit bucket and `User.lastIp`
   * records the proxy instead of the user. Accepts express's values:
   * "false", "true", "loopback", or a hop count like "1".
   */
  TRUST_PROXY: z.string().default('false'),

  /**
   * Serves the OpenAPI explorer at /api/docs. It describes every endpoint,
   * including the ones an attacker has not discovered, so it is off by
   * default and REFUSED in production.
   */
  SWAGGER_ENABLED: booleanish('false'),

  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug', 'verbose'])
    .default('info'),

  /** Error-tracking DSN. Absent means error tracking is disabled. */
  SENTRY_DSN: z.string().url().optional(),

  /**
   * Redis connection.
   *
   * DECISION (2026-08-25): optional in EVERY environment for now, because no
   * API code consumes it yet. Declaring it required would make the contract
   * lie about what the process actually needs, and a lying contract is worse
   * than a missing one.
   *
   * It becomes REQUIRED in production the moment either of these lands:
   *   1. the rate limiter moves off in-process storage (the current
   *      ThrottlerModule limit is per instance, so N instances = N x the
   *      intended limit), or
   *   2. background jobs / queues are introduced.
   *
   * Compose already provisions Redis so the move needs no infra work — see
   * checklists/03-API.md C.1.13.
   */
  REDIS_URL: z.string().url().optional(),
});

type BaseEnv = z.infer<typeof baseEnvSchema>;

/**
 * Rules that apply only to a real production boot. Kept out of the base shape
 * so a developer laptop is not forced to invent a 32-character secret or an
 * origin allow-list, while a production process cannot start without them.
 */
function productionRules(env: BaseEnv, ctx: z.RefinementCtx): void {
  if (env.NODE_ENV !== 'production') return;

  const fail = (path: string, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

  // Credentialed CORS cannot use a wildcard, and reflecting any origin would
  // let a hostile page make authenticated calls with the user's cookie.
  if (env.CORS_ORIGIN === '*') {
    fail(
      'CORS_ORIGIN',
      'CORS_ORIGIN="*" is not permitted in production. List exact origins, ' +
        'or set CORS_ORIGIN_SUFFIX for subdomain-per-tenant deployments.',
    );
  }
  if (env.CORS_ORIGIN === '*' && env.CORS_ORIGIN_SUFFIX === '') {
    fail(
      'CORS_ORIGIN_SUFFIX',
      'No browser origin is allowed: set CORS_ORIGIN to an explicit list, ' +
        'CORS_ORIGIN_SUFFIX to a domain suffix, or both.',
    );
  }

  // Behind an ALB/CloudFront, req.ip is the proxy unless this is set. Rate
  // limiting and the auth audit trail both become meaningless without it.
  if (env.TRUST_PROXY === 'false') {
    fail(
      'TRUST_PROXY',
      'TRUST_PROXY must be set in production (the API runs behind a load ' +
        'balancer). Use the number of proxy hops, e.g. "1".',
    );
  }

  // A short secret is brute-forceable offline; a shared secret means an access
  // token can be replayed as a refresh token.
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    if (env[key].length < SECRET_MIN) {
      fail(
        key,
        `${key} must be at least ${SECRET_MIN} characters in production.`,
      );
    }
  }
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    fail(
      'JWT_REFRESH_SECRET',
      'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET, otherwise an ' +
        'access token can be presented as a refresh token.',
    );
  }

  // The explorer documents every endpoint. Not in production.
  if (env.SWAGGER_ENABLED) {
    fail('SWAGGER_ENABLED', 'SWAGGER_ENABLED must be false in production.');
  }

  // The API must connect as the RLS-bound role, the migration job as the
  // owner. Identical URLs means the API is running as the owner and RLS is
  // bypassed for every query. PrismaService also checks this against the live
  // connection at boot; this catches it one step earlier, in config.
  if (env.DIRECT_URL && env.DATABASE_URL === env.DIRECT_URL) {
    fail(
      'DATABASE_URL',
      'DATABASE_URL must not equal DIRECT_URL in production: the API must ' +
        'connect as the RLS-bound role (greatsales_app), not as the owner.',
    );
  }
}

/** The validated contract: the base shape plus the production-only rules. */
export const envSchema = baseEnvSchema.superRefine(productionRules);

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
