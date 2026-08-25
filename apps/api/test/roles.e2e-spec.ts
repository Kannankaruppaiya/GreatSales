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
 * The /roles contract over HTTP.
 *
 * The case worth the most here is PERMISSION SEPARATION: `GET /roles` is
 * readable with `user.manage` (the user editor needs the dropdown), while
 * every write demands `role.manage`. A single permission check would either
 * lock an administrator out of their own user form or hand out role editing by
 * accident, and only an end-to-end test with a purpose-built role catches it.
 */
const ROLES = '/api/v1/roles';
const OK_PW = 'towel-forty-two-vogon';
const TENANT = 'tenant_acme';

let app: INestApplication<App>;
let adminToken: string;
let salesToken: string;
let mgmtToken: string;
/** A user holding user.manage but NOT role.manage. */
let userManagerToken: string;

let ipCounter = 0;
const nextIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;

async function signIn(email: string, password = 'Passw0rd!'): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', nextIp())
    .send({ tenantId: TENANT, email, password })
    .expect(201);
  return (res.body as { accessToken: string }).accessToken;
}

const as = (token: string) => {
  const http = app.getHttpServer();
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  return {
    list: () => auth(request(http).get(ROLES)),
    permissions: () => auth(request(http).get('/api/v1/permissions')),
    create: (b: object) => auth(request(http).post(ROLES)).send(b),
    update: (id: string, b: object) =>
      auth(request(http).patch(`${ROLES}/${id}`)).send(b),
    remove: (id: string) => auth(request(http).delete(`${ROLES}/${id}`)),
  };
};

const bodyOf = (res: request.Response) =>
  res.body as Record<string, unknown> & { code?: string };

/**
 * Builds a user whose role grants `user.manage` but not `role.manage`, and
 * signs them in. This is the principal the separation tests hinge on.
 */
async function makeUserManager(): Promise<string> {
  const prisma = app.get(PrismaService);
  const db = prisma.forTenant(TENANT);

  const userManage = await db.permission.findFirstOrThrow({
    where: { key: 'user.manage' },
  });
  const role = await db.role.create({
    data: { tenantId: TENANT, name: 'user-manager-only', isSystem: false },
  });
  await db.rolePermission.create({
    data: { roleId: role.id, permissionId: userManage.id },
  });
  await db.user.create({
    data: {
      tenantId: TENANT,
      name: 'User Manager Only',
      email: 'usermanager@acme.test',
      username: 'usermanager_acme',
      passwordHash: await hashPassword(OK_PW),
      roleId: role.id,
    },
  });
  return signIn('usermanager@acme.test', OK_PW);
}

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
  userManagerToken = await makeUserManager();
}, 240_000);

afterAll(async () => {
  await app.close();
});

describe('authentication', () => {
  it('401s an unauthenticated list', async () => {
    await request(app.getHttpServer()).get(ROLES).expect(401);
  });
});

describe('authorization', () => {
  it('403s a sales user on list', async () => {
    await as(salesToken).list().expect(403);
  });

  it('403s a management user on list', async () => {
    await as(mgmtToken).list().expect(403);
  });

  it.each([
    [
      'create',
      (t: string) =>
        as(t).create({ name: 'x', permissionKeys: ['report.view'] }),
    ],
    ['update', (t: string) => as(t).update('role_viewer_acme', { name: 'x' })],
    ['delete', (t: string) => as(t).remove('role_viewer_acme')],
  ])('403s a sales user on %s', async (_label, call) => {
    await call(salesToken).expect(403);
  });

  it('allows an admin to list', async () => {
    await as(adminToken).list().expect(200);
  });
});

describe('permission separation — user.manage vs role.manage', () => {
  it('LETS a user.manage-only caller READ roles, for the user editor dropdown', async () => {
    const res = await as(userManagerToken).list().expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('REFUSES that same caller creating a role', async () => {
    await as(userManagerToken)
      .create({ name: 'sneaky', permissionKeys: ['report.view'] })
      .expect(403);
  });

  it('REFUSES that same caller updating a role', async () => {
    await as(userManagerToken)
      .update('role_viewer_acme', { name: 'sneaky' })
      .expect(403);
  });

  it('REFUSES that same caller deleting a role', async () => {
    await as(userManagerToken).remove('role_viewer_acme').expect(403);
  });
});

describe('GET /permissions', () => {
  it('returns the catalogue to any authenticated caller', async () => {
    const res = await as(salesToken).permissions().expect(200);
    const groups = res.body as { module: string; permissions: unknown[] }[];
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.flatMap((g) => g.permissions)).toHaveLength(13);
  });

  it('401s without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/permissions').expect(401);
  });
});

describe('list contract', () => {
  it('includes a role with no users and its real grants', async () => {
    const res = await as(adminToken).list().expect(200);
    const roles = res.body as {
      id: string;
      userCount: number;
      permissionKeys: string[];
      isSystem: boolean;
    }[];

    const viewer = roles.find((r) => r.id === 'role_viewer_acme')!;
    expect(viewer.userCount).toBe(0);
    expect(viewer.isSystem).toBe(false);
    expect(viewer.permissionKeys.sort()).toEqual([
      'customer.read',
      'report.view',
    ]);
  });

  it('never exposes another tenant roles', async () => {
    const res = await as(adminToken).list().expect(200);
    const ids = (res.body as { id: string }[]).map((r) => r.id);
    expect(ids.some((id) => id.endsWith('_globex'))).toBe(false);
  });
});

describe('create contract', () => {
  it('201s a custom role', async () => {
    const res = await as(adminToken)
      .create({ name: 'wire role', permissionKeys: ['report.view'] })
      .expect(201);
    expect(bodyOf(res).isSystem).toBe(false);
  });

  it('400s an empty permission set', async () => {
    await as(adminToken)
      .create({ name: 'empty', permissionKeys: [] })
      .expect(400);
  });

  it('400s a name longer than the maximum', async () => {
    await as(adminToken)
      .create({ name: 'x'.repeat(61), permissionKeys: ['report.view'] })
      .expect(400);
  });

  it('400s INVALID_REFERENCE on an unknown permission key', async () => {
    const res = await as(adminToken)
      .create({ name: 'bogus wire', permissionKeys: ['not.a.permission'] })
      .expect(400);
    expect(bodyOf(res).code).toBe('INVALID_REFERENCE');
  });

  it('409s DUPLICATE_IDENTITY on a taken name', async () => {
    const res = await as(adminToken)
      .create({ name: 'admin', permissionKeys: ['report.view'] })
      .expect(409);
    expect(bodyOf(res).code).toBe('DUPLICATE_IDENTITY');
  });
});

describe('invariants over HTTP', () => {
  it('409s SYSTEM_ROLE_PROTECTED when renaming a built-in role', async () => {
    const res = await as(adminToken)
      .update('role_sales_acme', { name: 'renamed' })
      .expect(409);
    expect(bodyOf(res).code).toBe('SYSTEM_ROLE_PROTECTED');
  });

  it('409s SYSTEM_ROLE_PROTECTED when deleting a built-in role', async () => {
    const res = await as(adminToken).remove('role_mgmt_acme').expect(409);
    expect(bodyOf(res).code).toBe('SYSTEM_ROLE_PROTECTED');
  });

  it('409s LAST_ADMIN_ROLE_PROTECTED when stripping user.manage', async () => {
    const res = await as(adminToken)
      .update('role_admin_acme', { permissionKeys: ['customer.read'] })
      .expect(409);
    expect(bodyOf(res).code).toBe('LAST_ADMIN_ROLE_PROTECTED');
  });

  it('404s ROLE_NOT_FOUND for a role in another tenant', async () => {
    const res = await as(adminToken)
      .update('role_viewer_globex', { name: 'hijack' })
      .expect(404);
    expect(bodyOf(res).code).toBe('ROLE_NOT_FOUND');
  });
});

describe('delete', () => {
  it('204s an unused custom role and it disappears from the list', async () => {
    const created = await as(adminToken)
      .create({ name: 'ephemeral role', permissionKeys: ['report.view'] })
      .expect(201);
    const id = bodyOf(created).id as string;

    await as(adminToken).remove(id).expect(204);

    const res = await as(adminToken).list().expect(200);
    expect((res.body as { id: string }[]).some((r) => r.id === id)).toBe(false);
  });

  it('409s ROLE_IN_USE for a custom role that still has users', async () => {
    const created = await as(adminToken)
      .create({ name: 'occupied role', permissionKeys: ['report.view'] })
      .expect(201);
    const id = bodyOf(created).id as string;

    await request(app.getHttpServer())
      .patch('/api/v1/users/user_sales2_acme')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: id })
      .expect(200);

    const res = await as(adminToken).remove(id).expect(409);
    expect(bodyOf(res).code).toBe('ROLE_IN_USE');
  });
});
