import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { execSync } from 'node:child_process';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import { makeAuthService } from './test-auth-factory';

/**
 * The last-admin guard is only worth having if it holds under concurrency.
 *
 * Checked outside a transaction, two administrators removing each other at the
 * same instant would each read "one other admin remains" and both commit,
 * leaving the tenant with none — and no way back in without a database edit.
 * The guard therefore takes a `FOR UPDATE` lock over the surviving-admin
 * candidate set inside the same transaction as the write, so the two requests
 * serialise and the second observes the first one's effect.
 *
 * This is the test that would fail if someone "simplified" the guard by
 * pulling the check out of the transaction.
 */
const ADMIN1 = 'user_admin_acme';
const ADMIN2 = 'user_admin2_acme';

const actor = (userId: string): RequestUser => ({
  userId,
  tenantId: 'tenant_acme',
  roleId: 'role_admin_acme',
});

const liveAdmins = (prisma: PrismaService) =>
  prisma.forTenant('tenant_acme').user.count({
    where: { roleId: 'role_admin_acme', active: true, deletedAt: null },
  });

let prisma: PrismaService;
let service: UsersService;

beforeAll(async () => {
  prisma = new PrismaService(process.env.DATABASE_URL as string);
  await prisma.onModuleInit();
  service = new UsersService(prisma, makeAuthService(prisma));
}, 120_000);

// The starting state must be exactly two administrators, so "one succeeds" is
// an unambiguous result rather than an artefact of leftover fixtures.
beforeEach(() => {
  execSync('pnpm --filter @greatsales/db db:seed', {
    cwd: process.cwd(),
    stdio: 'ignore',
  });
}, 120_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
});

describe('last-admin guard under concurrency', () => {
  it('starts from exactly two administrators', async () => {
    expect(await liveAdmins(prisma)).toBe(2);
  });

  it('lets exactly ONE of two simultaneous deletions succeed', async () => {
    const results = await Promise.allSettled([
      service.remove(actor(ADMIN2), ADMIN1),
      service.remove(actor(ADMIN1), ADMIN2),
    ]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    expect(succeeded).toHaveLength(1);
    expect(await liveAdmins(prisma)).toBe(1);
  }, 60_000);

  it('lets exactly ONE of two simultaneous deactivations succeed', async () => {
    const results = await Promise.allSettled([
      service.update(actor(ADMIN2), ADMIN1, { active: false }),
      service.update(actor(ADMIN1), ADMIN2, { active: false }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await liveAdmins(prisma)).toBe(1);
  }, 60_000);

  it('lets exactly ONE of two simultaneous demotions succeed', async () => {
    const results = await Promise.allSettled([
      service.update(actor(ADMIN2), ADMIN1, { roleId: 'role_sales_acme' }),
      service.update(actor(ADMIN1), ADMIN2, { roleId: 'role_sales_acme' }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await liveAdmins(prisma)).toBe(1);
  }, 60_000);

  it('survives a mixed race — one deletion against one demotion', async () => {
    const results = await Promise.allSettled([
      service.remove(actor(ADMIN2), ADMIN1),
      service.update(actor(ADMIN1), ADMIN2, { roleId: 'role_sales_acme' }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await liveAdmins(prisma)).toBe(1);
  }, 60_000);

  it('never leaves the tenant with zero administrators, whatever the outcome', async () => {
    // The single assertion this whole file exists to make.
    await Promise.allSettled([
      service.remove(actor(ADMIN2), ADMIN1),
      service.remove(actor(ADMIN1), ADMIN2),
      service.update(actor(ADMIN1), ADMIN2, { active: false }),
    ]);
    expect(await liveAdmins(prisma)).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
