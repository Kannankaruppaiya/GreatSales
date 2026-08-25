import '../src/load-env';
import { reseedTestDatabase } from '../src/test-support/reseed';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/auth/hash';

/**
 * HTTP-level sign-in behaviour: what actually crosses the wire.
 *
 * The service spec proves the security logic; this proves the transport —
 * that the refresh token really is confined to an httpOnly cookie, that the
 * error envelope leaks nothing, and that throttling actually engages.
 *
 * Throttling stays ENABLED here so the tests exercise production wiring. Each
 * test therefore presents its own client IP via X-Forwarded-For (honoured
 * because the app sets `trust proxy`), which is also a direct proof that
 * rate-limit buckets are per client and not shared.
 */
const LOGIN = '/api/v1/auth/login';
const REFRESH = '/api/v1/auth/refresh';
const LOGOUT = '/api/v1/auth/logout';
const ME = '/api/v1/auth/me';

const CREDS = {
  tenantId: 'tenant_acme',
  email: 'admin@acme.test',
  password: 'Passw0rd!',
};

let app: INestApplication<App>;

/** Unique client IP per call, so one test's attempts never throttle another's. */
let ipCounter = 0;
const nextIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;

/** A request bound to one simulated client. */
function client(ip: string = nextIp()) {
  const http = app.getHttpServer();
  return {
    ip,
    login: (body: Record<string, unknown> = CREDS) =>
      request(http).post(LOGIN).set('X-Forwarded-For', ip).send(body),
    refresh: (body: Record<string, unknown> = {}, cookie?: string) => {
      const r = request(http).post(REFRESH).set('X-Forwarded-For', ip);
      if (cookie) r.set('Cookie', cookie);
      return r.send(body);
    },
    logout: (
      body: Record<string, unknown> = {},
      cookie?: string,
      bearer?: string,
    ) => {
      const r = request(http).post(LOGOUT).set('X-Forwarded-For', ip);
      if (cookie) r.set('Cookie', cookie);
      if (bearer) r.set('Authorization', `Bearer ${bearer}`);
      return r.send(body);
    },
    me: (bearer?: string) => {
      const r = request(http).get(ME).set('X-Forwarded-For', ip);
      if (bearer) r.set('Authorization', `Bearer ${bearer}`);
      return r.send();
    },
  };
}

/**
 * Supertest types `body(res)` as `any`. Reading fields off it would silently
 * opt every assertion out of type checking, so narrow it once here and let the
 * compiler check the rest.
 */
interface AuthResponseBody {
  accessToken?: string;
  refreshToken?: string;
  refreshTokenValue?: string;
  expiresIn?: number;
  revoked?: number;
  user?: {
    email?: string;
    role?: string | null;
    permissions?: string[];
    mustChangePassword?: boolean;
  };
  // Shared ApiErrorBody envelope
  statusCode?: number;
  error?: string;
  /** Stable machine-readable cause, present on deliberate failures. */
  code?: string;
  message?: string;
  path?: string;
  timestamp?: string;
  // GET /auth/me returns the profile at the top level
  email?: string;
  permissions?: string[];
  mustChangePassword?: boolean;
}
const body = (res: request.Response): AuthResponseBody =>
  res.body as AuthResponseBody;

const cookiesOf = (res: request.Response): string[] => {
  const raw = res.headers['set-cookie'];
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
};
const refreshCookie = (res: request.Response): string | undefined =>
  cookiesOf(res).find((c) => c.startsWith('gs_rt='));

beforeAll(async () => {
  reseedTestDatabase();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
  // Mirrors main.ts: without this, X-Forwarded-For is ignored and every client
  // shares one rate-limit bucket.
  nestApp.set('trust proxy', true);
  app = nestApp as unknown as INestApplication<App>;
  nestApp.use(cookieParser());
  nestApp.setGlobalPrefix('api/v1');
  nestApp.useGlobalFilters(new AllExceptionsFilter());
  await nestApp.init();
}, 180_000);

afterAll(async () => {
  await app?.close();
});

// ============================================== refresh token confinement (D1)

describe('POST /auth/login — cookie delivery (browser default)', () => {
  it('returns the access token and the profile', async () => {
    const res = await client().login();
    expect(res.status).toBe(201);
    expect(body(res).accessToken).toEqual(expect.any(String));
    expect(body(res).expiresIn).toEqual(expect.any(Number));
    expect(body(res).user?.email).toBe(CREDS.email);
  });

  it('does NOT put the refresh token anywhere JavaScript can read it', async () => {
    const res = await client().login();
    expect(body(res).refreshToken).toBeUndefined();
    expect(body(res).refreshTokenValue).toBeUndefined();
    expect(JSON.stringify(body(res))).not.toContain('"refresh');
  });

  it('sets the refresh token as an httpOnly, SameSite, path-scoped cookie', async () => {
    const cookie = refreshCookie(await client().login());
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/v1/auth');
  });

  it('marks the cookie Secure outside development', async () => {
    // load-env leaves NODE_ENV as jest's "test", i.e. not development.
    expect(process.env.NODE_ENV).not.toBe('development');
    expect(refreshCookie(await client().login())).toContain('Secure');
  });

  it('never leaks the password hash', async () => {
    const res = await client().login();
    expect(JSON.stringify(body(res))).not.toContain('argon2');
  });
});

describe('POST /auth/login — body delivery (native clients)', () => {
  it('returns the refresh token in the body and sets no cookie', async () => {
    const res = await client().login({ ...CREDS, tokenDelivery: 'body' });
    expect(res.status).toBe(201);
    expect(body(res).refreshToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).toBeUndefined();
  });
});

// ==================================================================== refresh

describe('POST /auth/refresh', () => {
  it('rotates using only the cookie — no token in the request body', async () => {
    const c = client();
    const jar = refreshCookie(await c.login()) as string;

    const res = await c.refresh({}, jar);

    expect(res.status).toBe(201);
    expect(body(res).accessToken).toEqual(expect.any(String));
    expect(body(res).refreshToken).toBeUndefined(); // stays in the cookie
    expect(refreshCookie(res)).toBeDefined(); // rotated cookie issued
  });

  it('rotates using the body for a client that sent it that way', async () => {
    const c = client();
    const login = await c.login({ ...CREDS, tokenDelivery: 'body' });

    const res = await c.refresh({ refreshToken: body(login).refreshToken });

    expect(res.status).toBe(201);
    expect(body(res).refreshToken).toEqual(expect.any(String));
    expect(body(res).refreshToken).not.toBe(body(login).refreshToken);
  });

  it('rejects a request carrying no token at all', async () => {
    const res = await client().refresh();
    expect(res.status).toBe(401);
  });

  it('clears the dead cookie when the presented token is rejected', async () => {
    const c = client();
    const jar = refreshCookie(await c.login()) as string;
    await c.logout({}, jar);

    const res = await c.refresh({}, jar);

    expect(res.status).toBe(401);
    // An expired cookie tells the browser to stop replaying a dead credential.
    expect(refreshCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);
  });
});

// ===================================================================== logout

describe('POST /auth/logout', () => {
  it('returns 200, clears the cookie, and kills the session', async () => {
    const c = client();
    const jar = refreshCookie(await c.login()) as string;

    const out = await c.logout({}, jar);
    expect(out.status).toBe(200);
    expect(refreshCookie(out)).toBeDefined();

    expect((await c.refresh({}, jar)).status).toBe(401);
  });

  it('works without any credential rather than erroring', async () => {
    const res = await client().logout();
    expect(res.status).toBe(200);
    expect(body(res).revoked).toBe(0);
  });

  it('ignores allSessions when no valid access token is supplied', async () => {
    const c = client();
    const first = await c.login();
    const other = await c.login();

    // allSessions without a bearer token must fall back to this family only.
    await c.logout({ allSessions: true }, refreshCookie(first) as string);

    const stillAlive = await c.refresh({}, refreshCookie(other) as string);
    expect(stillAlive.status).toBe(201);
  });

  it('signs out every device when a valid access token authorises it', async () => {
    const c = client();
    const laptop = await c.login();
    const phone = await c.login();

    await c.logout(
      { allSessions: true },
      refreshCookie(laptop) as string,
      body(laptop).accessToken,
    );

    const res = await c.refresh({}, refreshCookie(phone) as string);
    expect(res.status).toBe(401);
  });
});

// ================================================================ error shape

describe('error contract', () => {
  it('answers bad credentials with the shared envelope and nothing more', async () => {
    const res = await client().login({ ...CREDS, password: 'wrong' });

    expect(res.status).toBe(401);
    expect(body(res)).toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials',
      path: LOGIN,
    });
    expect(body(res).timestamp).toEqual(expect.any(String));
  });

  it('leaks no stack trace, file path, or SQL', async () => {
    const res = await client().login({ ...CREDS, password: 'wrong' });
    const serialized = JSON.stringify(body(res));
    expect(serialized).not.toMatch(/at .+\(.+:\d+:\d+\)/); // stack frame
    expect(serialized).not.toContain('node_modules');
    expect(serialized).not.toContain('SELECT');
    expect(serialized).not.toContain('prisma');
  });

  it('gives the same answer for an unknown email as for a wrong password', async () => {
    const wrongPw = await client().login({ ...CREDS, password: 'wrong' });
    const noSuchUser = await client().login({
      ...CREDS,
      email: 'ghost@acme.test',
    });

    expect(noSuchUser.status).toBe(wrongPw.status);
    expect(body(noSuchUser).message).toBe(body(wrongPw).message);
  });

  it('rejects a malformed body with 400, not 500', async () => {
    const res = await client().login({ tenantId: 'tenant_acme' });
    expect(res.status).toBe(400);
  });

  it('rejects a non-email address', async () => {
    const res = await client().login({ ...CREDS, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown tokenDelivery value', async () => {
    const res = await client().login({
      ...CREDS,
      tokenDelivery: 'querystring',
    });
    expect(res.status).toBe(400);
  });

  it('rejects an oversized password instead of hashing it', async () => {
    const res = await client().login({
      ...CREDS,
      password: 'x'.repeat(100_000),
    });
    expect([400, 401]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});

// ======================================================================= /me

describe('GET /auth/me', () => {
  it('requires a bearer token', async () => {
    expect((await client().me()).status).toBe(401);
  });

  it('rejects a refresh token used as a bearer token', async () => {
    const c = client();
    const login = await c.login({ ...CREDS, tokenDelivery: 'body' });
    expect((await c.me(body(login).refreshToken)).status).toBe(401);
  });

  it('rejects a garbage bearer token', async () => {
    expect((await client().me('not.a.jwt')).status).toBe(401);
  });

  it('returns the profile for a valid access token', async () => {
    const c = client();
    const login = await c.login();
    const res = await c.me(body(login).accessToken);
    expect(res.status).toBe(200);
    expect(body(res).email).toBe(CREDS.email);
  });
});

// ================================================================= throttling

describe('rate limiting', () => {
  it('answers 429 once one client has spent its login budget', async () => {
    const c = client('203.0.113.77'); // dedicated IP: this test spends its bucket
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      statuses.push((await c.login({ ...CREDS, password: 'wrong' })).status);
    }
    expect(statuses).toContain(429);
    // Budget is 5/minute, so the sixth attempt onward must be throttled.
    expect(statuses.slice(5).every((s) => s === 429)).toBe(true);
  }, 60_000);

  it('throttles per client, so one attacker cannot rate-limit everyone', async () => {
    const attacker = client('203.0.113.88');
    for (let i = 0; i < 8; i++) {
      await attacker.login({ ...CREDS, password: 'wrong' });
    }
    expect((await attacker.login()).status).toBe(429);

    // A different client signing in as a DIFFERENT account is unaffected.
    //
    // It must be a different account: those eight failures also tripped the
    // per-account lockout on admin@acme.test, which is the intended
    // instance-independent control and would answer 403 here. The two controls
    // are deliberately separate, and this asserts the per-IP one in isolation.
    const bystander = client('203.0.113.99');
    const res = await bystander.login({ ...CREDS, email: 'sales1@acme.test' });
    expect(res.status).toBe(201);
  }, 60_000);

  it('locks the targeted account itself — the accepted cost of lockout', async () => {
    // Documents the trade-off rather than pretending it does not exist: an
    // attacker CAN temporarily lock a known account. Lockout is time-bounded
    // for exactly this reason (AGENTS.md §29).
    const attacker = client('203.0.113.111');
    for (let i = 0; i < 6; i++) {
      await attacker.login({
        ...CREDS,
        email: 'sales2@acme.test',
        password: 'x',
      });
    }
    const victim = client('203.0.113.112');
    const res = await victim.login({ ...CREDS, email: 'sales2@acme.test' });
    expect(res.status).toBe(403);
    expect(body(res).message).toMatch(/locked/i);
  }, 60_000);
});

/**
 * The forced-password-change gate, proved end to end.
 *
 * `mustChangePassword` is handed to the client so the UI can route the user to
 * the change screen. That is a courtesy. These tests prove the SERVER refuses
 * to serve a flagged session, so a client that ignores the flag — or an
 * attacker calling the API directly with a valid token — gets nothing.
 */
describe('mustChangePassword gate', () => {
  const FLAGGED_EMAIL = 'admin2@acme.test';
  const FLAGGED_ID = 'user_admin2_acme';
  const STRONG_NEW_PASSWORD = 'towel-forty-two-vogon';

  /**
   * Earlier describes in this file deliberately lock accounts out to prove the
   * lockout policy. This suite shares one database, so those locks are still
   * standing by the time we get here — clear them for the two accounts this
   * describe signs in with, rather than depending on test order.
   */
  beforeEach(async () => {
    const prisma = app.get(PrismaService);
    await prisma.forTenant('tenant_acme').user.updateMany({
      where: { id: { in: [FLAGGED_ID, 'user_admin_acme'] } },
      data: { failedLoginAttempts: 0, lockedUntil: null, active: true },
    });
  });

  /** Flags the seeded second admin and returns a fresh access token for them. */
  async function flaggedSession(): Promise<string> {
    const prisma = app.get(PrismaService);
    await prisma.forTenant('tenant_acme').user.update({
      where: { id: FLAGGED_ID },
      data: { mustChangePassword: true },
    });

    const res = await client()
      .login({ ...CREDS, email: FLAGGED_EMAIL })
      .expect(201);
    return body(res).accessToken as string;
  }

  // Restores the fixture rather than reseeding: re-hashing one password is
  // milliseconds, where a full reseed per test would add minutes to the suite.
  // The hash is recomputed rather than pasted, so rotating the seed password
  // cannot silently desync this file from it.
  afterEach(async () => {
    const prisma = app.get(PrismaService);
    await prisma.forTenant('tenant_acme').user.update({
      where: { id: FLAGGED_ID },
      data: {
        mustChangePassword: false,
        passwordHash: await hashPassword(CREDS.password),
      },
    });
  });

  it('reports the flag on the login response, so the UI can react', async () => {
    const prisma = app.get(PrismaService);
    await prisma.forTenant('tenant_acme').user.update({
      where: { id: FLAGGED_ID },
      data: { mustChangePassword: true },
    });
    const res = await client()
      .login({ ...CREDS, email: FLAGGED_EMAIL })
      .expect(201); // POST /auth/login carries no @HttpCode, so Nest answers 201
    expect(body(res).user?.mustChangePassword).toBe(true);
  });

  it('blocks an ordinary endpoint with 403 PASSWORD_CHANGE_REQUIRED', async () => {
    const token = await flaggedSession();
    const res = await request(app.getHttpServer())
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(body(res).code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('still allows /auth/me, so the client can discover WHY it is blocked', async () => {
    const token = await flaggedSession();
    const res = await client().me(token).expect(200);
    expect(body(res).mustChangePassword).toBe(true);
  });

  it('still allows /auth/change-password — the only way out', async () => {
    const token = await flaggedSession();
    await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: CREDS.password,
        newPassword: STRONG_NEW_PASSWORD,
      })
      .expect(200);
  });

  it('unblocks every endpoint once the password has actually been changed', async () => {
    const token = await flaggedSession();
    await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: CREDS.password,
        newPassword: STRONG_NEW_PASSWORD,
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('rejects a weak replacement with WEAK_PASSWORD, keeping the gate closed', async () => {
    const token = await flaggedSession();
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: CREDS.password, newPassword: 'qwerty' })
      .expect(400);
    expect(body(res).code).toBe('WEAK_PASSWORD');

    await request(app.getHttpServer())
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('does not gate an UNFLAGGED session', async () => {
    const login = await client().login().expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${body(login).accessToken}`)
      .expect(200);
  });

  it('still answers 401, not 403, when there is no token at all', async () => {
    // Authentication must be decided before the password gate, or an
    // anonymous caller would receive a message about a password they do not
    // have.
    await request(app.getHttpServer()).get('/api/v1/customers').expect(401);
  });
});
