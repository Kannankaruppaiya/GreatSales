import '../src/load-env';
import { execSync } from 'node:child_process';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';

/**
 * The /teams contract over HTTP.
 *
 * Teams sit behind `user.manage`, so a sales or management user must be
 * refused on every route — including the read ones, since team membership
 * describes the org chart.
 */
const TEAMS = '/api/v1/teams';
const TENANT = 'tenant_acme';

let app: INestApplication<App>;
let adminToken: string;
let salesToken: string;
let mgmtToken: string;

let ipCounter = 0;
const nextIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;

async function signIn(email: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', nextIp())
    .send({ tenantId: TENANT, email, password: 'Passw0rd!' })
    .expect(201);
  return (res.body as { accessToken: string }).accessToken;
}

const as = (token: string) => {
  const http = app.getHttpServer();
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  return {
    list: () => auth(request(http).get(TEAMS)),
    create: (b: object) => auth(request(http).post(TEAMS)).send(b),
    update: (id: string, b: object) =>
      auth(request(http).patch(`${TEAMS}/${id}`)).send(b),
    remove: (id: string) => auth(request(http).delete(`${TEAMS}/${id}`)),
    members: (id: string) => auth(request(http).get(`${TEAMS}/${id}/members`)),
    addMembers: (id: string, b: object) =>
      auth(request(http).post(`${TEAMS}/${id}/members`)).send(b),
    removeMember: (id: string, userId: string) =>
      auth(request(http).delete(`${TEAMS}/${id}/members/${userId}`)),
  };
};

const bodyOf = (res: request.Response) =>
  res.body as Record<string, unknown> & { code?: string };

beforeAll(async () => {
  execSync('pnpm --filter @greatsales/db db:seed', {
    cwd: process.cwd(),
    stdio: 'ignore',
  });

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
  it('401s an unauthenticated list', async () => {
    await request(app.getHttpServer()).get(TEAMS).expect(401);
  });
});

describe('authorization — every route, both non-admin roles', () => {
  const routes: [string, (t: string) => request.Test][] = [
    ['list', (t) => as(t).list()],
    ['create', (t) => as(t).create({ name: 'X', managerId: 'user_mgr_acme' })],
    ['update', (t) => as(t).update('team_acme', { name: 'X' })],
    ['delete', (t) => as(t).remove('team_acme')],
    ['members', (t) => as(t).members('team_acme')],
    [
      'add members',
      (t) => as(t).addMembers('team_acme', { userIds: ['user_sales2_acme'] }),
    ],
    [
      'remove member',
      (t) => as(t).removeMember('team_acme', 'user_sales2_acme'),
    ],
  ];

  it.each(routes)('403s a SALES user on %s', async (_label, call) => {
    await call(salesToken).expect(403);
  });

  it.each(routes)('403s a MANAGEMENT user on %s', async (_label, call) => {
    await call(mgmtToken).expect(403);
  });

  it('allows an admin to list', async () => {
    await as(adminToken).list().expect(200);
  });
});

describe('create contract', () => {
  it('201s a team', async () => {
    const res = await as(adminToken)
      .create({ name: 'Wire Team', managerId: 'user_mgr_acme' })
      .expect(201);
    expect(bodyOf(res).managerName).toBe('Acme Corp Manager');
  });

  it('400s a missing managerId', async () => {
    await as(adminToken).create({ name: 'No Manager' }).expect(400);
  });

  it('400s a name longer than the maximum', async () => {
    await as(adminToken)
      .create({ name: 'x'.repeat(81), managerId: 'user_mgr_acme' })
      .expect(400);
  });

  it('400s INVALID_MANAGER for a cross-tenant manager', async () => {
    const res = await as(adminToken)
      .create({ name: 'Cross Tenant', managerId: 'user_mgr_globex' })
      .expect(400);
    expect(bodyOf(res).code).toBe('INVALID_MANAGER');
  });
});

describe('membership contract', () => {
  it('400s an empty userIds array', async () => {
    await as(adminToken)
      .addMembers('team_secondary_acme', { userIds: [] })
      .expect(400);
  });

  it('400s a batch above the cap', async () => {
    await as(adminToken)
      .addMembers('team_secondary_acme', {
        userIds: Array.from({ length: 201 }, (_, i) => `u${i}`),
      })
      .expect(400);
  });

  it('200s a valid bulk add and reports how many changed', async () => {
    const res = await as(adminToken)
      .addMembers('team_secondary_acme', {
        userIds: ['user_bulk_acme_03', 'user_bulk_acme_04'],
      })
      .expect(200);
    expect(res.body).toEqual({ added: 2 });
  });

  it('204s a member removal', async () => {
    await as(adminToken)
      .removeMember('team_secondary_acme', 'user_bulk_acme_03')
      .expect(204);
  });

  it('lists members without any password hash', async () => {
    const res = await as(adminToken).members('team_acme').expect(200);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$argon2/);
  });
});

describe('isolation and delete', () => {
  it('404s TEAM_NOT_FOUND for a team in another tenant', async () => {
    const res = await as(adminToken)
      .update('team_globex', { name: 'Hijack' })
      .expect(404);
    expect(bodyOf(res).code).toBe('TEAM_NOT_FOUND');
  });

  it('204s a delete, and the members are detached as seen through /users', async () => {
    const created = await as(adminToken)
      .create({ name: 'Doomed Team', managerId: 'user_mgr_acme' })
      .expect(201);
    const id = bodyOf(created).id as string;

    await as(adminToken)
      .addMembers(id, { userIds: ['user_bulk_acme_05'] })
      .expect(200);

    await as(adminToken).remove(id).expect(204);

    const user = await request(app.getHttpServer())
      .get('/api/v1/users/user_bulk_acme_05')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((user.body as { teamId: string | null }).teamId).toBeNull();
  });
});
