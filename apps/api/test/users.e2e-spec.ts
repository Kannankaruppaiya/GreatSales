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

/**
 * What actually crosses the wire for /users.
 *
 * The service specs prove the business rules. This proves the CONTRACT: the
 * status codes, the `code` field clients branch on, and — above all — that
 * authorization is decided by the SERVER and not merely by which buttons the
 * web app chooses to render. Every route is exercised with a `sales` and a
 * `mgmt` token, both of which must be refused.
 */
const BASE = '/api/v1/users';
const OK_PW = 'towel-forty-two-vogon';
const TENANT = 'tenant_acme';

let app: INestApplication<App>;
let adminToken: string;
let salesToken: string;
let mgmtToken: string;

/** Unique client IP per sign-in, so login throttling never bites the suite. */
let ipCounter = 0;
const nextIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;

async function signIn(email: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', nextIp())
    .send({ tenantId: TENANT, email, password: 'Passw0rd!' })
    .expect(201); // POST /auth/login carries no @HttpCode, so Nest answers 201
  return (res.body as { accessToken: string }).accessToken;
}

/** Every /users verb, bound to one caller's token. */
const as = (token: string) => {
  const http = app.getHttpServer();
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  return {
    get: (path = '') => auth(request(http).get(BASE + path)),
    post: (path = '') => auth(request(http).post(BASE + path)),
    patch: (path = '') => auth(request(http).patch(BASE + path)),
    del: (path = '') => auth(request(http).delete(BASE + path)),
  };
};

const bodyOf = (res: request.Response) =>
  res.body as Record<string, unknown> & {
    code?: string;
    items?: { id: string; active: boolean }[];
    total?: number;
    nextCursor?: string | null;
  };

beforeAll(async () => {
  reseedTestDatabase();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());
  (app as NestExpressApplication).set('trust proxy', 1);
  await app.init();

  adminToken = await signIn('admin@acme.test');
  salesToken = await signIn('sales1@acme.test');
  mgmtToken = await signIn('manager@acme.test');
}, 240_000);

afterAll(async () => {
  await app.close();
});

describe('authentication', () => {
  it('rejects an unauthenticated list with 401', async () => {
    await request(app.getHttpServer()).get(BASE).expect(401);
  });

  it('rejects a garbage bearer token with 401', async () => {
    await request(app.getHttpServer())
      .get(BASE)
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });
});

describe('authorization — the server decides, not the UI', () => {
  /** Every mutating and reading route, so none can be forgotten. */
  const routes: [string, (t: string) => request.Test][] = [
    ['list', (t) => as(t).get()],
    ['get', (t) => as(t).get('/user_sales2_acme')],
    [
      'create',
      (t) =>
        as(t).post().send({
          name: 'Should Not Exist',
          email: 'nope@acme.test',
          username: 'nope_acme',
          password: OK_PW,
          roleId: 'role_sales_acme',
        }),
    ],
    ['update', (t) => as(t).patch('/user_sales2_acme').send({ name: 'X' })],
    ['delete', (t) => as(t).del('/user_sales2_acme')],
    ['restore', (t) => as(t).post('/user_sales2_acme/restore')],
    [
      'reset-password',
      (t) =>
        as(t)
          .post('/user_sales2_acme/reset-password')
          .send({ password: OK_PW }),
    ],
  ];

  it.each(routes)('403s a SALES user on %s', async (_label, call) => {
    await call(salesToken).expect(403);
  });

  it.each(routes)('403s a MANAGEMENT user on %s', async (_label, call) => {
    await call(mgmtToken).expect(403);
  });

  it('and the refused create really did not happen', async () => {
    const list = await as(adminToken).get('?limit=100&search=nope').expect(200);
    expect(bodyOf(list).items).toHaveLength(0);
  });

  it('allows an admin to list', async () => {
    await as(adminToken).get().expect(200);
  });
});

describe('list contract', () => {
  it('returns items, nextCursor and total', async () => {
    const res = await as(adminToken).get('?limit=5').expect(200);
    const body = bodyOf(res);
    expect(body.items).toHaveLength(5);
    expect(typeof body.total).toBe('number');
    expect(body.total).toBeGreaterThan(5);
    expect(typeof body.nextCursor).toBe('string');
  });

  it('status=inactive really filters to inactive users', async () => {
    const res = await as(adminToken)
      .get('?status=inactive&limit=100')
      .expect(200);
    const items = bodyOf(res).items ?? [];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((u) => !u.active)).toBe(true);
  });

  it('status=active really filters to active users', async () => {
    const res = await as(adminToken)
      .get('?status=active&limit=100')
      .expect(200);
    const items = bodyOf(res).items ?? [];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((u) => u.active)).toBe(true);
  });

  it('400s an unknown status value rather than silently ignoring it', async () => {
    await as(adminToken).get('?status=maybe').expect(400);
  });

  it('400s a limit above the maximum', async () => {
    await as(adminToken).get('?limit=1000').expect(400);
  });

  it('400s an unknown sort column', async () => {
    await as(adminToken).get('?sort=passwordHash').expect(400);
  });

  it('never serialises a password hash', async () => {
    const res = await as(adminToken)
      .get('?limit=100&includeDeleted=true')
      .expect(200);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$argon2/);
  });
});

describe('create contract', () => {
  it('201s and returns a row with no credential and a forced change', async () => {
    const res = await as(adminToken)
      .post()
      .send({
        name: 'Wire User',
        email: 'wire@acme.test',
        username: 'wire_acme',
        password: OK_PW,
        roleId: 'role_sales_acme',
      })
      .expect(201);

    const body = bodyOf(res);
    expect(body.email).toBe('wire@acme.test');
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('passwordHash');
    expect(body.mustChangePassword).toBe(true);
  });

  it('400s a malformed email with a ValidationError envelope', async () => {
    const res = await as(adminToken)
      .post()
      .send({
        name: 'Bad Email',
        email: 'not-an-email',
        username: 'bademail_acme',
        password: OK_PW,
        roleId: 'role_sales_acme',
      })
      .expect(400);
    expect(bodyOf(res).error).toBe('ValidationError');
  });

  it('400s WEAK_PASSWORD with the code clients branch on', async () => {
    const res = await as(adminToken)
      .post()
      .send({
        name: 'Weak Password',
        email: 'weakpw@acme.test',
        username: 'weakpw_acme',
        password: 'qwerty',
        roleId: 'role_sales_acme',
      })
      .expect(400);
    expect(bodyOf(res).code).toBe('WEAK_PASSWORD');
  });

  it('409s DUPLICATE_IDENTITY on a taken email', async () => {
    const res = await as(adminToken)
      .post()
      .send({
        name: 'Duplicate',
        email: 'admin@acme.test',
        username: 'dup_acme',
        password: OK_PW,
        roleId: 'role_sales_acme',
      })
      .expect(409);
    expect(bodyOf(res).code).toBe('DUPLICATE_IDENTITY');
  });

  it('409s on a taken email that differs only in case', async () => {
    const res = await as(adminToken)
      .post()
      .send({
        name: 'Case Duplicate',
        email: 'ADMIN@ACME.TEST',
        username: 'casedup_acme',
        password: OK_PW,
        roleId: 'role_sales_acme',
      })
      .expect(409);
    expect(bodyOf(res).code).toBe('DUPLICATE_IDENTITY');
  });

  it('400s INVALID_REFERENCE on an unknown role — not a 500', async () => {
    const res = await as(adminToken)
      .post()
      .send({
        name: 'No Such Role',
        email: 'norole@acme.test',
        username: 'norole_acme',
        password: OK_PW,
        roleId: 'role_does_not_exist',
      })
      .expect(400);
    expect(bodyOf(res).code).toBe('INVALID_REFERENCE');
  });
});

describe('invariants over HTTP', () => {
  it('409s SELF_MUTATION_FORBIDDEN when deactivating yourself', async () => {
    const res = await as(adminToken)
      .patch('/user_admin_acme')
      .send({ active: false })
      .expect(409);
    expect(bodyOf(res).code).toBe('SELF_MUTATION_FORBIDDEN');
  });

  it('409s SELF_MUTATION_FORBIDDEN when deleting yourself', async () => {
    const res = await as(adminToken).del('/user_admin_acme').expect(409);
    expect(bodyOf(res).code).toBe('SELF_MUTATION_FORBIDDEN');
  });

  it('409s SELF_MUTATION_FORBIDDEN when resetting your own password', async () => {
    const res = await as(adminToken)
      .post('/user_admin_acme/reset-password')
      .send({ password: OK_PW })
      .expect(409);
    expect(bodyOf(res).code).toBe('SELF_MUTATION_FORBIDDEN');
  });

  it('400s INVALID_MANAGER on a self-managing assignment', async () => {
    const res = await as(adminToken)
      .patch('/user_sales1_acme')
      .send({ managerId: 'user_sales1_acme' })
      .expect(400);
    expect(bodyOf(res).code).toBe('INVALID_MANAGER');
  });

  it('404s a cross-tenant user, revealing nothing about its existence', async () => {
    const res = await as(adminToken).get('/user_sales1_globex').expect(404);
    expect(bodyOf(res).code).toBe('USER_NOT_FOUND');
  });

  it('404s an update aimed at a cross-tenant user', async () => {
    await as(adminToken)
      .patch('/user_sales1_globex')
      .send({ name: 'Hijacked' })
      .expect(404);
  });

  it('404s a delete aimed at a cross-tenant user', async () => {
    await as(adminToken).del('/user_sales1_globex').expect(404);
  });
});

describe('delete, restore, and identity reuse', () => {
  it('204s a delete and drops the user from the default list', async () => {
    const created = await as(adminToken)
      .post()
      .send({
        name: 'Ephemeral',
        email: 'ephemeral@acme.test',
        username: 'ephemeral_acme',
        password: OK_PW,
        roleId: 'role_sales_acme',
      })
      .expect(201);
    const id = bodyOf(created).id as string;

    await as(adminToken).del(`/${id}`).expect(204);

    const after = await as(adminToken).get('?limit=100').expect(200);
    expect((bodyOf(after).items ?? []).some((u) => u.id === id)).toBe(false);

    await as(adminToken).post(`/${id}/restore`).expect(201);

    const restored = await as(adminToken).get('?limit=100').expect(200);
    expect((bodyOf(restored).items ?? []).some((u) => u.id === id)).toBe(true);
  });

  it('frees the email and username for reuse while the user is deleted', async () => {
    const first = await as(adminToken)
      .post()
      .send({
        name: 'Recycle One',
        email: 'recycle@acme.test',
        username: 'recycle_acme',
        password: OK_PW,
        roleId: 'role_sales_acme',
      })
      .expect(201);

    await as(adminToken)
      .del(`/${bodyOf(first).id as string}`)
      .expect(204);

    // The whole point of the partial unique index.
    await as(adminToken)
      .post()
      .send({
        name: 'Recycle Two',
        email: 'recycle@acme.test',
        username: 'recycle_acme',
        password: OK_PW,
        roleId: 'role_sales_acme',
      })
      .expect(201);
  });
});

describe('reset-password', () => {
  it('200s, forces a change, and does not echo the password', async () => {
    const res = await as(adminToken)
      .post('/user_sales2_acme/reset-password')
      .send({ password: OK_PW })
      .expect(200);

    expect(res.body).toEqual({ mustChangePassword: true });
    expect(JSON.stringify(res.body)).not.toContain(OK_PW);
  });

  it('gates the target until they choose a new password', async () => {
    await as(adminToken)
      .post('/user_sales1_acme/reset-password')
      .send({ password: OK_PW })
      .expect(200);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ tenantId: TENANT, email: 'sales1@acme.test', password: OK_PW })
      .expect(201);

    const body = login.body as {
      accessToken: string;
      user: { mustChangePassword: boolean };
    };
    expect(body.user.mustChangePassword).toBe(true);

    const blocked = await request(app.getHttpServer())
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(403);
    expect(bodyOf(blocked).code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});
