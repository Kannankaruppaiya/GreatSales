import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { execSync } from 'node:child_process';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import { makeAuthService } from './test-auth-factory';

/**
 * The two rules that keep a tenant able to administer itself.
 *
 * I1 — you cannot strip your OWN administrative access. Deactivating,
 * deleting, or demoting yourself is how an administrator locks themselves out
 * with nobody left to help. Editing your own name is harmless and stays
 * allowed; the guard is targeted at the three fields that matter.
 *
 * I2 — the LAST holder of `user.manage` cannot be removed by any route:
 * deactivation, deletion, or demotion to a role that lacks the permission. A
 * tenant that reaches zero administrators cannot recover without a database
 * edit, which is exactly the situation this whole feature exists to prevent.
 *
 * Both are checked inside the same transaction as the write, so two
 * simultaneous requests cannot each observe "one other admin remains" and both
 * proceed. The concurrency proof lives in users.concurrency.spec.ts.
 */
const ADMIN1 = 'user_admin_acme';
const ADMIN2 = 'user_admin2_acme';

const actor = (userId: string): RequestUser => ({
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

// Every test here deactivates or deletes an admin. Without a per-test reseed
// the second test would start from the first one's wreckage.
beforeEach(() => {
  execSync('pnpm --filter @greatsales/db db:seed', {
    cwd: process.cwd(),
    stdio: 'ignore',
  });
}, 120_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
});

describe('I1 — you cannot strip your own administrative access', () => {
  const me = actor(ADMIN1);

  it('refuses to deactivate your own account', async () => {
    await expect(
      service.update(me, ADMIN1, { active: false }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'SELF_MUTATION_FORBIDDEN' },
    });
  });

  it('refuses to delete your own account', async () => {
    await expect(service.remove(me, ADMIN1)).rejects.toMatchObject({
      status: 409,
      response: { code: 'SELF_MUTATION_FORBIDDEN' },
    });
  });

  it('refuses to change your own role', async () => {
    await expect(
      service.update(me, ADMIN1, { roleId: 'role_sales_acme' }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'SELF_MUTATION_FORBIDDEN' },
    });
  });

  it('ALLOWS editing your own name — not every self-edit is dangerous', async () => {
    await expect(
      service.update(me, ADMIN1, { name: 'Renamed Self' }),
    ).resolves.toMatchObject({ name: 'Renamed Self' });
  });

  it('ALLOWS editing your own email', async () => {
    await expect(
      service.update(me, ADMIN1, { email: 'newaddress@acme.test' }),
    ).resolves.toMatchObject({ email: 'newaddress@acme.test' });
  });

  it('leaves the account untouched after a refused self-deactivation', async () => {
    await expect(
      service.update(me, ADMIN1, { active: false }),
    ).rejects.toThrow();
    const row = await prisma
      .forTenant('tenant_acme')
      .user.findUniqueOrThrow({ where: { id: ADMIN1 } });
    expect(row.active).toBe(true);
  });
});

describe('I2 — the last administrator is protected', () => {
  /** Leaves exactly one live holder of user.manage: ADMIN1. */
  const isolateAdmin1 = () =>
    service.update(actor(ADMIN1), ADMIN2, { active: false });

  it('allows removing the SECOND admin while one remains', async () => {
    await expect(isolateAdmin1()).resolves.toMatchObject({ active: false });
  });

  it('refuses to deactivate the last admin', async () => {
    await isolateAdmin1();
    await expect(
      service.update(actor(ADMIN2), ADMIN1, { active: false }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'LAST_ADMIN_PROTECTED' },
    });
  });

  it('refuses to DELETE the last admin', async () => {
    await isolateAdmin1();
    await expect(service.remove(actor(ADMIN2), ADMIN1)).rejects.toMatchObject({
      status: 409,
      response: { code: 'LAST_ADMIN_PROTECTED' },
    });
  });

  it('refuses to DEMOTE the last admin to a role without user.manage', async () => {
    await isolateAdmin1();
    await expect(
      service.update(actor(ADMIN2), ADMIN1, { roleId: 'role_sales_acme' }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'LAST_ADMIN_PROTECTED' },
    });
  });

  it('ALLOWS moving the last admin to another role that still grants user.manage', async () => {
    // The rule is about the permission surviving, not about the role id
    // staying the same.
    const db = prisma.forTenant('tenant_acme');
    const permission = await db.permission.findFirstOrThrow({
      where: { key: 'user.manage' },
    });
    const spare = await db.role.create({
      data: { tenantId: 'tenant_acme', name: 'deputy', isSystem: false },
    });
    await db.rolePermission.create({
      data: { roleId: spare.id, permissionId: permission.id },
    });

    await isolateAdmin1();
    await expect(
      service.update(actor(ADMIN2), ADMIN1, { roleId: spare.id }),
    ).resolves.toMatchObject({ roleId: spare.id });
  });

  it('counts only ACTIVE, NON-DELETED admins as remaining cover', async () => {
    // A soft-deleted admin must not be mistaken for a colleague who could
    // still let you back in.
    const spare = await service.create(actor(ADMIN1), {
      name: 'Spare Admin',
      email: 'spare@acme.test',
      username: 'spare_acme',
      password: 'towel-forty-two-vogon',
      roleId: 'role_admin_acme',
    });
    await service.remove(actor(ADMIN1), spare.id);
    await isolateAdmin1();

    await expect(service.remove(actor(ADMIN2), ADMIN1)).rejects.toMatchObject({
      response: { code: 'LAST_ADMIN_PROTECTED' },
    });
  });

  it('leaves the tenant with a live administrator after every refusal', async () => {
    await isolateAdmin1();
    await service.remove(actor(ADMIN2), ADMIN1).catch(() => undefined);

    const remaining = await prisma.forTenant('tenant_acme').user.count({
      where: { roleId: 'role_admin_acme', active: true, deletedAt: null },
    });
    expect(remaining).toBeGreaterThanOrEqual(1);
  });

  it('does not block ordinary edits to the last admin', async () => {
    await isolateAdmin1();
    await expect(
      service.update(actor(ADMIN2), ADMIN1, { name: 'Still Editable' }),
    ).resolves.toMatchObject({ name: 'Still Editable' });
  });

  it('does not protect a non-admin user from removal', async () => {
    await expect(
      service.update(actor(ADMIN1), 'user_sales1_acme', { active: false }),
    ).resolves.toMatchObject({ active: false });
  });
});
