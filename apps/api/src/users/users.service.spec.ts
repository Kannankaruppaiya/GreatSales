import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { execSync } from 'node:child_process';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { verifyPassword } from '../auth/hash';
import { UsersService } from './users.service';
import { DEFAULT_USER_LIST_QUERY } from '@greatsales/shared';
import { makeAuthService } from './test-auth-factory';

const admin = (tid: string, roleKey: string): RequestUser => ({
  userId: `user_admin_${roleKey}`,
  tenantId: tid,
  roleId: `role_admin_${roleKey}`,
});

describe('UsersService (integration)', () => {
  let prisma: PrismaService;
  let service: UsersService;

  beforeAll(async () => {
    execSync('pnpm --filter @greatsales/db db:seed', {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    service = new UsersService(prisma, makeAuthService(prisma));
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('lists tenant users enriched with role/manager/team, never a hash', async () => {
    const res = await service.list(admin('tenant_acme', 'acme'), {
      ...DEFAULT_USER_LIST_QUERY,
      limit: 100,
    });

    // Assert the rows this test cares about, not a raw count: the fixture
    // grows as new invariants need new users, and a length assertion would
    // fail for reasons unrelated to what is being tested here.
    expect(res.items.map((u) => u.email)).toEqual(
      expect.arrayContaining(['admin@acme.test', 'sales1@acme.test']),
    );
    const a = res.items.find((u) => u.email === 'admin@acme.test')!;
    expect(a.roleName).toBe('admin');
    expect(a).not.toHaveProperty('passwordHash');

    const s1 = res.items.find((u) => u.username === 'sales1_acme')!;
    expect(s1.managerName).toBe('Acme Corp Manager');
    expect(s1.teamName).toBe('Acme Corp Team');
  });

  it('isolates tenants — Globex admin never sees Acme users (RLS)', async () => {
    const res = await service.list(admin('tenant_globex', 'globex'), {
      ...DEFAULT_USER_LIST_QUERY,
      limit: 100,
    });
    expect(res.items.length).toBeGreaterThan(0);
    // Every row belongs to Globex, and — stated positively as well as
    // negatively — not one Acme row leaked through.
    expect(res.items.every((u) => u.email.endsWith('@globex.test'))).toBe(true);
    expect(res.items.some((u) => u.email.endsWith('@acme.test'))).toBe(false);
  });

  it('creates a user and stores a real password hash (not plaintext)', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      name: 'New Rep',
      email: 'newrep@acme.test',
      username: 'newrep_acme',
      password: 'S3cretPassw0rd',
      roleId: 'role_sales_acme',
    });
    expect(created.email).toBe('newrep@acme.test');
    expect(created.roleName).toBe('sales');

    const raw = await prisma
      .forTenant('tenant_acme')
      .user.findUnique({ where: { id: created.id } });
    expect(raw!.passwordHash).not.toBe('S3cretPassw0rd');
    expect(await verifyPassword(raw!.passwordHash, 'S3cretPassw0rd')).toBe(
      true,
    );
  });

  it('rejects a duplicate email within the tenant', async () => {
    await expect(
      service.create(admin('tenant_acme', 'acme'), {
        name: 'Clash',
        email: 'admin@acme.test', // already taken
        username: 'clash_acme',
        password: 'S3cretPassw0rd',
        roleId: 'role_sales_acme',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates scalar fields', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      ...DEFAULT_USER_LIST_QUERY,
      limit: 20,
    });
    const id = list.items.find((u) => u.username === 'sales2_acme')!.id;

    const updated = await service.update(admin('tenant_acme', 'acme'), id, {
      name: 'Renamed Rep',
      active: false,
    });
    expect(updated.name).toBe('Renamed Rep');
    expect(updated.active).toBe(false);
  });

  it('re-hashes the password on update', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      ...DEFAULT_USER_LIST_QUERY,
      limit: 20,
    });
    const id = list.items.find((u) => u.username === 'sales1_acme')!.id;

    await service.update(admin('tenant_acme', 'acme'), id, {
      password: 'BrandN3wPass',
    });
    const raw = await prisma
      .forTenant('tenant_acme')
      .user.findUnique({ where: { id } });
    expect(await verifyPassword(raw!.passwordHash, 'BrandN3wPass')).toBe(true);
    expect(await verifyPassword(raw!.passwordHash, 'Passw0rd!')).toBe(false);
  });

  it('soft-deletes a user so it drops out of the list', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      name: 'Doomed User',
      email: 'doomed@acme.test',
      username: 'doomed_acme',
      password: 'S3cretPassw0rd',
      roleId: 'role_sales_acme',
    });
    await service.remove(admin('tenant_acme', 'acme'), created.id);

    const list = await service.list(admin('tenant_acme', 'acme'), {
      ...DEFAULT_USER_LIST_QUERY,
      limit: 50,
    });
    expect(list.items.some((u) => u.id === created.id)).toBe(false);
    await expect(
      service.update(admin('tenant_acme', 'acme'), created.id, { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

/**
 * List contract: filtering, sorting, and paging.
 *
 * The status filter is the one that matters most here. It previously used
 * `z.coerce.boolean()`, which maps the STRING "false" to true — so asking for
 * inactive users returned active ones. An enum replaces it, because an enum
 * has no coercion to get wrong.
 */
describe('UsersService.list — filtering, sorting, pagination', () => {
  let prisma: PrismaService;
  let service: UsersService;

  const ACME = admin('tenant_acme', 'acme');
  /** Defaults the schema would have applied, spelled out for the service call. */
  const base = {
    limit: 100,
    status: 'all' as const,
    sort: 'name' as const,
    dir: 'asc' as const,
    includeDeleted: 'false' as const,
  };

  beforeAll(async () => {
    execSync('pnpm --filter @greatsales/db db:seed', {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    service = new UsersService(prisma, makeAuthService(prisma));
  }, 180_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('reports a total counting ALL matches, not just the returned page', async () => {
    const page = await service.list(ACME, { ...base, limit: 5 });
    expect(page.items).toHaveLength(5);
    expect(page.total).toBeGreaterThan(5);
    expect(page.nextCursor).not.toBeNull();
  });

  it('status=inactive returns ONLY inactive users', async () => {
    const res = await service.list(ACME, { ...base, status: 'inactive' });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((u) => u.active === false)).toBe(true);
  });

  it('status=active returns ONLY active users', async () => {
    const res = await service.list(ACME, { ...base, status: 'active' });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((u) => u.active === true)).toBe(true);
  });

  it('status=all returns both, and the two subsets sum to it', async () => {
    const all = await service.list(ACME, base);
    const on = await service.list(ACME, { ...base, status: 'active' });
    const off = await service.list(ACME, { ...base, status: 'inactive' });
    expect(on.total + off.total).toBe(all.total);
  });

  /**
   * Sorting is asserted by REVERSAL rather than by re-sorting in JavaScript.
   *
   * Postgres orders under its own collation, which does not agree with
   * `String.localeCompare` — `admin2@` sorts before `admin@` in the database
   * and after it in JS. Re-sorting in the test would therefore be asserting
   * that Node and Postgres share a collation, which is not true and not what
   * this feature promises. What it promises is: the column is ordered, and
   * `dir` reverses it.
   */
  it.each(['name', 'email', 'username', 'createdAt'] as const)(
    'orders by %s, and dir reverses that order exactly',
    async (sort) => {
      const asc = await service.list(ACME, { ...base, sort, dir: 'asc' });
      const desc = await service.list(ACME, { ...base, sort, dir: 'desc' });

      expect(asc.items.length).toBeGreaterThan(1);
      expect(desc.items.map((u) => u.id)).toEqual(
        [...asc.items].reverse().map((u) => u.id),
      );
    },
  );

  it('actually applies the sort rather than returning insertion order', async () => {
    const byName = await service.list(ACME, { ...base, sort: 'name' });
    const byEmail = await service.list(ACME, { ...base, sort: 'email' });
    // The two orderings must differ somewhere, or nothing is being sorted.
    expect(byName.items.map((u) => u.id)).not.toEqual(
      byEmail.items.map((u) => u.id),
    );
  });

  it('places names in non-decreasing order under the database collation', async () => {
    // Asserted against the database's own opinion, obtained from the same
    // query engine, rather than against a JS comparator.
    const res = await service.list(ACME, { ...base, sort: 'name' });
    const names = res.items.map((u) => u.name);
    const fromDb = await prisma.forTenant('tenant_acme').user.findMany({
      where: { deletedAt: null },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { name: true },
    });
    expect(names).toEqual(fromDb.map((u) => u.name));
  });

  it('pages without dropping or repeating a single row', async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 30; i++) {
      const page = await service.list(ACME, { ...base, limit: 5, cursor });
      seen.push(...page.items.map((u) => u.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(new Set(seen).size).toBe(seen.length);
    const { total } = await service.list(ACME, { ...base, limit: 1 });
    expect(seen).toHaveLength(total);
  });

  it('filters by teamId', async () => {
    const res = await service.list(ACME, { ...base, teamId: 'team_acme' });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((u) => u.teamId === 'team_acme')).toBe(true);
  });

  it('filters by roleId', async () => {
    const res = await service.list(ACME, {
      ...base,
      roleId: 'role_admin_acme',
    });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((u) => u.roleId === 'role_admin_acme')).toBe(true);
  });

  it('searches name, email and username case-insensitively', async () => {
    const byName = await service.list(ACME, { ...base, search: 'SALES ONE' });
    expect(byName.items.some((u) => u.username === 'sales1_acme')).toBe(true);

    const byEmail = await service.list(ACME, {
      ...base,
      search: 'SALES1@ACME',
    });
    expect(byEmail.items.some((u) => u.username === 'sales1_acme')).toBe(true);
  });

  it('hides soft-deleted users by default and reveals them on request', async () => {
    const created = await service.create(ACME, {
      name: 'Ghost User',
      email: 'ghost@acme.test',
      username: 'ghost_acme',
      password: 'towel-forty-two-vogon',
      roleId: 'role_sales_acme',
    });
    await service.remove(ACME, created.id);

    const hidden = await service.list(ACME, base);
    expect(hidden.items.some((u) => u.id === created.id)).toBe(false);

    const shown = await service.list(ACME, { ...base, includeDeleted: 'true' });
    const ghost = shown.items.find((u) => u.id === created.id);
    expect(ghost?.deletedAt).not.toBeNull();
  });

  it('never leaks a password hash in any row', async () => {
    const res = await service.list(ACME, { ...base, includeDeleted: 'true' });
    for (const row of res.items) {
      expect(Object.keys(row)).not.toContain('passwordHash');
    }
    expect(JSON.stringify(res.items)).not.toMatch(/\$argon2/);
  });

  it('keeps the total consistent with the rows a full walk returns', async () => {
    const first = await service.list(ACME, { ...base, limit: 1 });
    const everything = await service.list(ACME, { ...base, limit: 100 });
    expect(everything.items).toHaveLength(first.total);
  });
});
