import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { execSync } from 'node:child_process';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import { makeAuthService } from './test-auth-factory';

/**
 * The rules that make user administration safe, proven against real Postgres
 * under the RLS-bound role.
 *
 * Three classes of defect live here:
 *
 *   Identity hygiene — case is not identity. The client lower-casing a
 *   username is advice a direct API call simply ignores, so `Admin@x` and
 *   `admin@x` were two accounts, and the partial unique index could not tell
 *   them apart either.
 *
 *   Error contracts — an unknown roleId raised Prisma P2025 and surfaced as a
 *   500. That tells the caller nothing and pages an engineer for a typo.
 *
 *   The reporting graph — a cycle is not cosmetic. Anything that walks the
 *   chain (team rollups, approval routing, "my reports") would loop forever.
 *   Postgres cannot express "this foreign key must not close a cycle", so the
 *   service enforces it.
 */
const OK_PW = 'towel-forty-two-vogon';

const actor = (userId = 'user_admin_acme'): RequestUser => ({
  userId,
  tenantId: 'tenant_acme',
  roleId: 'role_admin_acme',
});

let prisma: PrismaService;
let service: UsersService;

beforeAll(async () => {
  prisma = new PrismaService(process.env.DATABASE_URL as string);
  await prisma.onModuleInit();
  service = new UsersService(prisma, makeAuthService(prisma));
}, 120_000);

// Reseeded per test: several of these deactivate or delete seeded users, and a
// later test reading a mutated fixture would be testing the previous test.
beforeEach(() => {
  execSync('pnpm --filter @greatsales/db db:seed', {
    cwd: process.cwd(),
    stdio: 'ignore',
  });
}, 120_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
});

describe('identity hygiene', () => {
  const ACME = actor();

  it('trims and lower-cases email and username server-side', async () => {
    const created = await service.create(ACME, {
      name: '  Mixed Case  ',
      email: '  MiXeD@Acme.TEST ',
      username: '  MiXeD_Acme  ',
      password: OK_PW,
      roleId: 'role_sales_acme',
    });
    expect(created.email).toBe('mixed@acme.test');
    expect(created.username).toBe('mixed_acme');
    expect(created.name).toBe('Mixed Case');
  });

  it('treats a differently-cased email as a duplicate', async () => {
    await expect(
      service.create(ACME, {
        name: 'Clash',
        email: 'ADMIN@ACME.TEST',
        username: 'clash_acme',
        password: OK_PW,
        roleId: 'role_sales_acme',
      }),
    ).rejects.toMatchObject({ response: { code: 'DUPLICATE_IDENTITY' } });
  });

  it('normalises identity on update too', async () => {
    const updated = await service.update(ACME, 'user_sales2_acme', {
      email: '  RENAMED@Acme.TEST  ',
    });
    expect(updated.email).toBe('renamed@acme.test');
  });
});

describe('password policy', () => {
  const ACME = actor();

  it('rejects a password below the policy minimum', async () => {
    await expect(
      service.create(ACME, {
        name: 'Weak',
        email: 'weak@acme.test',
        username: 'weak_acme',
        password: 'short1234',
        roleId: 'role_sales_acme',
      }),
    ).rejects.toMatchObject({ response: { code: 'WEAK_PASSWORD' } });
  });

  it('rejects a password containing the new account own username', async () => {
    await expect(
      service.create(ACME, {
        name: 'Selfy',
        email: 'selfy@acme.test',
        username: 'selfyuser',
        password: 'xx-selfyuser-xxxx',
        roleId: 'role_sales_acme',
      }),
    ).rejects.toMatchObject({ response: { code: 'WEAK_PASSWORD' } });
  });

  it('applies the same policy on update', async () => {
    await expect(
      service.update(ACME, 'user_sales2_acme', { password: '123456' }),
    ).rejects.toMatchObject({ response: { code: 'WEAK_PASSWORD' } });
  });

  it('forces a password change on a user an admin just created', async () => {
    // An admin-chosen password is a shared secret the moment it is typed.
    const created = await service.create(ACME, {
      name: 'Fresh Hire',
      email: 'fresh@acme.test',
      username: 'fresh_acme',
      password: OK_PW,
      roleId: 'role_sales_acme',
    });
    expect(created.mustChangePassword).toBe(true);
  });
});

describe('reference validity', () => {
  const ACME = actor();

  it('returns 400 INVALID_REFERENCE for an unknown roleId, never a 500', async () => {
    await expect(
      service.create(ACME, {
        name: 'NoRole',
        email: 'norole@acme.test',
        username: 'norole_acme',
        password: OK_PW,
        roleId: 'role_does_not_exist',
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_REFERENCE' },
    });
  });

  it('returns 400 INVALID_REFERENCE for a role belonging to ANOTHER tenant', async () => {
    // RLS makes a cross-tenant row indistinguishable from a missing one, which
    // is exactly the right amount of information to give the caller.
    await expect(
      service.create(ACME, {
        name: 'CrossTenant',
        email: 'cross@acme.test',
        username: 'cross_acme',
        password: OK_PW,
        roleId: 'role_sales_globex',
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_REFERENCE' },
    });
  });

  it('returns 400 INVALID_REFERENCE for an unknown teamId', async () => {
    await expect(
      service.create(ACME, {
        name: 'NoTeam',
        email: 'noteam@acme.test',
        username: 'noteam_acme',
        password: OK_PW,
        roleId: 'role_sales_acme',
        teamId: 'team_nope',
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_REFERENCE' },
    });
  });
});

describe('reporting graph', () => {
  const ACME = actor();

  const chain = (n: string, managerId?: string) =>
    service.create(ACME, {
      name: `Chain ${n}`,
      email: `chain${n}@acme.test`,
      username: `chain${n}`,
      password: OK_PW,
      roleId: 'role_sales_acme',
      ...(managerId ? { managerId } : {}),
    });

  it('rejects a user managing themselves', async () => {
    await expect(
      service.update(ACME, 'user_sales1_acme', {
        managerId: 'user_sales1_acme',
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_MANAGER' },
    });
  });

  it('rejects a two-node cycle', async () => {
    // sales1 already reports to mgr; making mgr report to sales1 closes a loop.
    await expect(
      service.update(ACME, 'user_mgr_acme', { managerId: 'user_sales1_acme' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_MANAGER' },
    });
  });

  it('rejects a three-node cycle', async () => {
    const a = await chain('a');
    const b = await chain('b', a.id);
    const c = await chain('c', b.id);
    await expect(
      service.update(ACME, a.id, { managerId: c.id }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_MANAGER' },
    });
  });

  it('ACCEPTS a legitimate deep chain — it rejects cycles, not depth', async () => {
    const a = await chain('a');
    const b = await chain('b', a.id);
    const c = await chain('c');
    await expect(
      service.update(ACME, c.id, { managerId: b.id }),
    ).resolves.toMatchObject({ managerId: b.id });
  });

  it('rejects a manager from another tenant', async () => {
    await expect(
      service.update(ACME, 'user_sales1_acme', {
        managerId: 'user_mgr_globex',
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_MANAGER' },
    });
  });

  it('rejects a soft-deleted manager', async () => {
    const ghost = await service.create(ACME, {
      name: 'Ghost Manager',
      email: 'ghostmgr@acme.test',
      username: 'ghostmgr',
      password: OK_PW,
      roleId: 'role_mgmt_acme',
    });
    await service.remove(ACME, ghost.id);
    await expect(
      service.update(ACME, 'user_sales1_acme', { managerId: ghost.id }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_MANAGER' },
    });
  });

  it('rejects an inactive manager', async () => {
    await service.update(ACME, 'user_sales2_acme', { active: false });
    await expect(
      service.update(ACME, 'user_sales1_acme', {
        managerId: 'user_sales2_acme',
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_MANAGER' },
    });
  });

  it('allows clearing the manager', async () => {
    const res = await service.update(ACME, 'user_sales1_acme', {
      managerId: null,
    });
    expect(res.managerId).toBeNull();
  });

  it('validates the manager on create as well as on update', async () => {
    await expect(chain('x', 'user_mgr_globex')).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_MANAGER' },
    });
  });
});
