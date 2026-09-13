import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { PERMISSION_KEYS, type RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { makeAuthService } from '../users/test-auth-factory';
import { RolesService } from './roles.service';

/**
 * Role administration.
 *
 * The web page previously rendered a HARDCODED permissions table that had no
 * relationship to actual RolePermission rows — free to lie at any time, and it
 * did, because the seed grants and the table disagreed. Everything here exists
 * so that table can be replaced by live data.
 *
 * The invariants are about recoverability. A tenant that deletes the role its
 * only administrator holds, or strips `user.manage` from the last role that
 * grants it, cannot get back in without a database edit.
 */
const ACME: RequestUser = {
  userId: 'user_admin_acme',
  tenantId: 'tenant_acme',
  roleId: 'role_admin_acme',
};

let prisma: PrismaService;
let auth: AuthService;
let service: RolesService;

beforeAll(async () => {
  prisma = new PrismaService(process.env.DATABASE_URL as string);
  await prisma.onModuleInit();
  auth = makeAuthService(prisma);
  service = new RolesService(prisma, auth);
}, 120_000);

beforeEach(() => {
  reseedTestDatabase();
}, 120_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
});

describe('list', () => {
  it('lists every tenant role, including one with no users', async () => {
    // The defect this fixes: the web derived its role dropdown from the roles
    // that happened to appear in loaded user rows, so a role with no members
    // could never receive its first one.
    const roles = await service.list(ACME);
    const viewer = roles.find((r) => r.id === 'role_viewer_acme');
    expect(viewer).toBeDefined();
    expect(viewer?.userCount).toBe(0);
  });

  it('returns the REAL permission grants for each role', async () => {
    const roles = await service.list(ACME);
    const admin = roles.find((r) => r.name === 'admin')!;
    const sales = roles.find((r) => r.name === 'sales')!;

    expect(admin.permissionKeys).toEqual(
      expect.arrayContaining(['user.manage', 'role.manage']),
    );
    expect(sales.permissionKeys).not.toContain('user.manage');
    expect(sales.permissionKeys).not.toContain('role.manage');
  });

  it('reports an accurate live user count per role', async () => {
    const roles = await service.list(ACME);
    const sales = roles.find((r) => r.name === 'sales')!;

    const actual = await prisma.forTenant('tenant_acme').user.count({
      where: { roleId: sales.id, deletedAt: null },
    });
    expect(sales.userCount).toBe(actual);
  });

  it('flags built-in roles as system and custom ones as not', async () => {
    const roles = await service.list(ACME);
    for (const name of ['admin', 'mgmt', 'sales']) {
      expect(roles.find((r) => r.name === name)?.isSystem).toBe(true);
    }
    expect(roles.find((r) => r.name === 'viewer')?.isSystem).toBe(false);
  });

  it('isolates tenants — Globex roles are invisible to an Acme caller', async () => {
    const roles = await service.list(ACME);
    expect(roles.some((r) => r.id.endsWith('_globex'))).toBe(false);
  });
});

describe('permission catalogue', () => {
  it('offers every permission the system understands, grouped by module', () => {
    const groups = service.permissions();
    const keys = groups.flatMap((g) => g.permissions.map((p) => p.key));
    expect(keys.sort()).toEqual([...PERMISSION_KEYS].sort());
  });

  it('gives every permission a human label, never a raw key', () => {
    for (const group of service.permissions()) {
      for (const permission of group.permissions) {
        expect(permission.label).not.toBe(permission.key);
        expect(permission.label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('create', () => {
  it('creates a custom role with exactly the requested grants', async () => {
    const role = await service.create(ACME, {
      name: 'regional head',
      permissionKeys: ['customer.read', 'report.view'],
    });
    expect(role.isSystem).toBe(false);
    expect(role.permissionKeys.sort()).toEqual([
      'customer.read',
      'report.view',
    ]);
    expect(role.userCount).toBe(0);
  });

  it('rejects an unknown permission key rather than silently dropping it', async () => {
    await expect(
      service.create(ACME, {
        name: 'bogus',
        permissionKeys: ['customer.read', 'nonsense.permission'],
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'INVALID_REFERENCE' },
    });
  });

  it('rejects a duplicate role name within the tenant', async () => {
    await expect(
      service.create(ACME, { name: 'admin', permissionKeys: ['report.view'] }),
    ).rejects.toMatchObject({ response: { code: 'DUPLICATE_IDENTITY' } });
  });

  it('never creates a role marked as a system role', async () => {
    const role = await service.create(ACME, {
      name: 'not a system role',
      permissionKeys: ['report.view'],
    });
    expect(role.isSystem).toBe(false);
  });
});

describe('update', () => {
  it('renames a custom role', async () => {
    const role = await service.create(ACME, {
      name: 'before',
      permissionKeys: ['report.view'],
    });
    await expect(
      service.update(ACME, role.id, { name: 'after' }),
    ).resolves.toMatchObject({ name: 'after' });
  });

  it('replaces the permission set wholesale', async () => {
    const role = await service.create(ACME, {
      name: 'wholesale',
      permissionKeys: ['customer.read', 'report.view'],
    });
    const updated = await service.update(ACME, role.id, {
      permissionKeys: ['lead.read'],
    });
    expect(updated.permissionKeys).toEqual(['lead.read']);
  });

  it('REFUSES to rename a system role', async () => {
    await expect(
      service.update(ACME, 'role_sales_acme', { name: 'renamed' }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'SYSTEM_ROLE_PROTECTED' },
    });
  });

  it('ALLOWS editing a system role permissions — tenants may narrow them', async () => {
    const updated = await service.update(ACME, 'role_mgmt_acme', {
      permissionKeys: ['customer.read'],
    });
    expect(updated.permissionKeys).toEqual(['customer.read']);
  });

  it('404s a role in another tenant', async () => {
    await expect(
      service.update(ACME, 'role_sales_globex', { name: 'hijack' }),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'ROLE_NOT_FOUND' },
    });
  });

  it('REFUSES to strip user.manage from the last role that grants it', async () => {
    await expect(
      service.update(ACME, 'role_admin_acme', {
        permissionKeys: ['customer.read'],
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'LAST_ADMIN_ROLE_PROTECTED' },
    });
  });

  it('allows stripping it once another POPULATED role also grants it', async () => {
    const deputy = await service.create(ACME, {
      name: 'deputy',
      permissionKeys: ['user.manage', 'role.manage'],
    });
    // A role with the permission but no members is no cover at all, so the
    // guard must still refuse until someone actually holds it.
    await expect(
      service.update(ACME, 'role_admin_acme', {
        permissionKeys: ['customer.read'],
      }),
    ).rejects.toMatchObject({
      response: { code: 'LAST_ADMIN_ROLE_PROTECTED' },
    });

    await prisma.forTenant('tenant_acme').user.update({
      where: { id: 'user_admin2_acme' },
      data: { roleId: deputy.id },
    });

    await expect(
      service.update(ACME, 'role_admin_acme', {
        permissionKeys: ['customer.read'],
      }),
    ).resolves.toBeDefined();
  });

  it('revokes the sessions of every user in a role whose grants changed', async () => {
    // Permissions are resolved per request, but the ACCESS token carries
    // roleId. A narrowed role must take effect now, not at token expiry.
    await auth.login({
      tenantId: 'tenant_acme',
      email: 'sales1@acme.test',
      password: 'Passw0rd!',
      tokenDelivery: 'cookie' as const,
      client: 'web' as const,
    });
    const live = () =>
      prisma.forTenant('tenant_acme').refreshToken.count({
        where: { userId: 'user_sales1_acme', revokedAt: null },
      });
    expect(await live()).toBeGreaterThan(0);

    await service.update(ACME, 'role_sales_acme', {
      permissionKeys: ['customer.read'],
    });
    expect(await live()).toBe(0);
  });

  it('writes an audit row carrying both permission sets', async () => {
    const role = await service.create(ACME, {
      name: 'audited role',
      permissionKeys: ['customer.read'],
    });
    await service.update(ACME, role.id, { permissionKeys: ['report.view'] });

    const rows = await prisma.forTenant('tenant_acme').auditLog.findMany({
      where: { entity: 'Role', entityId: role.id },
      orderBy: { at: 'asc' },
    });
    expect(rows.map((r) => r.action)).toEqual(['role.created', 'role.updated']);
    expect(rows[1].before).toMatchObject({ permissionKeys: ['customer.read'] });
    expect(rows[1].after).toMatchObject({ permissionKeys: ['report.view'] });
  });
});

describe('delete', () => {
  it('deletes an unused custom role', async () => {
    const role = await service.create(ACME, {
      name: 'disposable',
      permissionKeys: ['report.view'],
    });
    await service.remove(ACME, role.id);

    const roles = await service.list(ACME);
    expect(roles.some((r) => r.id === role.id)).toBe(false);
  });

  it('REFUSES to delete a CUSTOM role that still has users', async () => {
    // Deliberately a custom role: a system role would be refused for being
    // built-in, which would not prove the in-use rule at all.
    const role = await service.create(ACME, {
      name: 'occupied',
      permissionKeys: ['report.view'],
    });
    await prisma.forTenant('tenant_acme').user.update({
      where: { id: 'user_sales2_acme' },
      data: { roleId: role.id },
    });

    await expect(service.remove(ACME, role.id)).rejects.toMatchObject({
      status: 409,
      response: { code: 'ROLE_IN_USE' },
    });
  });

  it('names how many users still hold the role, so the message is actionable', async () => {
    const role = await service.create(ACME, {
      name: 'occupied two',
      permissionKeys: ['report.view'],
    });
    await prisma.forTenant('tenant_acme').user.update({
      where: { id: 'user_sales2_acme' },
      data: { roleId: role.id },
    });

    const error = await service.remove(ACME, role.id).catch((e: unknown) => e);
    expect(
      (error as { response: { message: string } }).response.message,
    ).toMatch(/1 user/);
  });

  it('REFUSES to delete a role whose only users are soft-deleted', async () => {
    // Their roleId still points here. Hard-deleting the role would leave a
    // dangling reference that RBAC would resolve to an empty permission set.
    const role = await service.create(ACME, {
      name: 'ghost role',
      permissionKeys: ['report.view'],
    });
    const db = prisma.forTenant('tenant_acme');
    const user = await db.user.create({
      data: {
        tenantId: 'tenant_acme',
        name: 'Ghost Holder',
        email: 'ghostholder@acme.test',
        username: 'ghostholder',
        passwordHash: 'x',
        roleId: role.id,
        deletedAt: new Date(),
      },
    });
    expect(user.roleId).toBe(role.id);

    await expect(service.remove(ACME, role.id)).rejects.toMatchObject({
      response: { code: 'ROLE_IN_USE' },
    });
  });

  it('REFUSES to delete a system role', async () => {
    // role_viewer is custom and unused; mgmt is a system role with no users in
    // the fixture, which isolates "system" as the reason for refusal.
    await expect(service.remove(ACME, 'role_mgmt_acme')).rejects.toMatchObject({
      status: 409,
      response: { code: 'SYSTEM_ROLE_PROTECTED' },
    });
  });

  it('404s a role in another tenant', async () => {
    await expect(
      service.remove(ACME, 'role_viewer_globex'),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'ROLE_NOT_FOUND' },
    });
  });
});
