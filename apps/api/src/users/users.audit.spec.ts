import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UsersService } from './users.service';

/**
 * Two obligations that every administrative write must discharge.
 *
 * AUDIT (AGENTS.md §25) — who changed this, when, from what, to what. Written
 * inside the same transaction as the change, so an audit gap is impossible in
 * either direction: no orphan rows for writes that rolled back, and no silent
 * writes with no trace.
 *
 * REVOCATION — deactivating a user, deleting them, changing their role, or
 * resetting their password all took effect only at their next refresh, leaving
 * a window as long as the access-token TTL during which a disabled account
 * kept working. Worse for a role change: the access token carries `roleId`, so
 * a demoted user retained their old permissions until it expired.
 */
const OK_PW = 'towel-forty-two-vogon';
const ACME: RequestUser = {
  userId: 'user_admin_acme',
  tenantId: 'tenant_acme',
  roleId: 'role_admin_acme',
};

let prisma: PrismaService;
let auth: AuthService;
let service: UsersService;

beforeAll(async () => {
  prisma = new PrismaService(process.env.DATABASE_URL as string);
  await prisma.onModuleInit();
  auth = new AuthService(
    prisma,
    new JwtService({}),
    new ConfigService({
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '7d',
      NODE_ENV: 'test',
    }),
  );
  service = new UsersService(prisma, auth);
}, 120_000);

beforeEach(() => {
  reseedTestDatabase();
}, 120_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
});

const auditsFor = (entityId: string) =>
  prisma.forTenant('tenant_acme').auditLog.findMany({
    where: { entity: 'User', entityId },
    orderBy: { at: 'asc' },
  });

const liveSessions = (userId: string) =>
  prisma
    .forTenant('tenant_acme')
    .refreshToken.count({ where: { userId, revokedAt: null } });

const signIn = (email: string) =>
  auth.login({
    tenantId: 'tenant_acme',
    email,
    password: 'Passw0rd!',
    tokenDelivery: 'cookie' as const,
    client: 'web' as const,
  });

describe('audit trail', () => {
  it('records a create with the actor and the resulting state', async () => {
    const created = await service.create(ACME, {
      name: 'Audited User',
      email: 'audited@acme.test',
      username: 'audited_acme',
      password: OK_PW,
      roleId: 'role_sales_acme',
    });

    const [row] = await auditsFor(created.id);
    expect(row.action).toBe('user.created');
    expect(row.userId).toBe(ACME.userId);
    expect(row.before).toBeNull();
    expect(row.after).toMatchObject({ email: 'audited@acme.test' });
  });

  it('records an update with BOTH the previous and the new value', async () => {
    await service.update(ACME, 'user_sales2_acme', {
      name: 'Renamed In Audit',
    });

    const rows = await auditsFor('user_sales2_acme');
    const last = rows[rows.length - 1];
    expect(last.action).toBe('user.updated');
    expect(last.before).toMatchObject({ name: 'Acme Corp Sales Two' });
    expect(last.after).toMatchObject({ name: 'Renamed In Audit' });
  });

  it('records a delete and a restore in order', async () => {
    const user = await service.create(ACME, {
      name: 'Round Trip',
      email: 'roundtrip@acme.test',
      username: 'roundtrip_acme',
      password: OK_PW,
      roleId: 'role_sales_acme',
    });
    await service.remove(ACME, user.id);
    await service.restore(ACME, user.id);

    expect((await auditsFor(user.id)).map((r) => r.action)).toEqual([
      'user.created',
      'user.deleted',
      'user.restored',
    ]);
  });

  it('NEVER writes a password or a hash into an audit row', async () => {
    // The fixture identity and the three passwords share no substring, so the
    // policy cannot reject them — this test is about redaction, not policy.
    const SECOND_PW = 'brambling-quilt-harbour';
    const THIRD_PW = 'lantern-oxbow-plinth';

    const user = await service.create(ACME, {
      name: 'Vault Keeper',
      email: 'vault@acme.test',
      username: 'vault_acme',
      password: OK_PW,
      roleId: 'role_sales_acme',
    });
    await service.update(ACME, user.id, { password: SECOND_PW });
    await service.resetPassword(ACME, user.id, { password: THIRD_PW });

    const rows = await auditsFor(user.id);
    expect(rows.length).toBeGreaterThanOrEqual(3);

    for (const row of rows) {
      const json = JSON.stringify({ before: row.before, after: row.after });
      expect(json).not.toMatch(/password/i);
      expect(json).not.toMatch(/\$argon2/);
      expect(json).not.toContain(OK_PW);
      expect(json).not.toContain(SECOND_PW);
      expect(json).not.toContain(THIRD_PW);
    }
  });

  it('rolls the audit row back with the write — no orphan audit', async () => {
    const before = (await auditsFor('user_admin_acme')).length;

    // A self-deactivation is refused; nothing, the audit included, may persist.
    await expect(
      service.update(ACME, 'user_admin_acme', { active: false }),
    ).rejects.toThrow();

    expect((await auditsFor('user_admin_acme')).length).toBe(before);
  });

  it('attributes the change to the ACTOR, not the target', async () => {
    const other: RequestUser = { ...ACME, userId: 'user_admin2_acme' };
    await service.update(other, 'user_sales1_acme', { name: 'By Admin Two' });

    const rows = await auditsFor('user_sales1_acme');
    expect(rows[rows.length - 1].userId).toBe('user_admin2_acme');
  });
});

describe('session revocation on administrative writes', () => {
  it('revokes the target sessions when they are deactivated', async () => {
    await signIn('sales1@acme.test');
    expect(await liveSessions('user_sales1_acme')).toBeGreaterThan(0);

    await service.update(ACME, 'user_sales1_acme', { active: false });
    expect(await liveSessions('user_sales1_acme')).toBe(0);
  });

  it('revokes the target sessions when they are deleted', async () => {
    await signIn('sales2@acme.test');
    await service.remove(ACME, 'user_sales2_acme');
    expect(await liveSessions('user_sales2_acme')).toBe(0);
  });

  it('revokes the target sessions when their password is reset', async () => {
    await signIn('sales1@acme.test');
    await service.resetPassword(ACME, 'user_sales1_acme', { password: OK_PW });
    expect(await liveSessions('user_sales1_acme')).toBe(0);
  });

  it('revokes the target sessions when their ROLE changes', async () => {
    // The access token carries roleId, so without this a demoted user keeps
    // the old role's permissions until the token expires.
    await signIn('sales1@acme.test');
    await service.update(ACME, 'user_sales1_acme', {
      roleId: 'role_mgmt_acme',
    });
    expect(await liveSessions('user_sales1_acme')).toBe(0);
  });

  it('records WHY each session ended', async () => {
    await signIn('sales1@acme.test');
    await service.update(ACME, 'user_sales1_acme', { active: false });

    const row = await prisma.forTenant('tenant_acme').refreshToken.findFirst({
      where: { userId: 'user_sales1_acme', revokedReason: 'admin_deactivated' },
    });
    expect(row).not.toBeNull();
  });

  it('does NOT revoke on a harmless edit', async () => {
    await signIn('sales1@acme.test');
    await service.update(ACME, 'user_sales1_acme', { name: 'Just A Rename' });
    expect(await liveSessions('user_sales1_acme')).toBeGreaterThan(0);
  });

  it('leaves an unrelated user sessions alone', async () => {
    await signIn('sales1@acme.test');
    await signIn('sales2@acme.test');

    await service.update(ACME, 'user_sales1_acme', { active: false });
    expect(await liveSessions('user_sales2_acme')).toBeGreaterThan(0);
  });

  it('does not revoke when the write is refused', async () => {
    await signIn('sales1@acme.test');
    const before = await liveSessions('user_sales1_acme');

    await expect(
      service.update(ACME, 'user_sales1_acme', { password: 'qwerty' }),
    ).rejects.toThrow();

    expect(await liveSessions('user_sales1_acme')).toBe(before);
  });
});
