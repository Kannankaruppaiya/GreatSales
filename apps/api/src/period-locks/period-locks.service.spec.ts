import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PeriodLocksService } from './period-locks.service';
import { ProjectionsService } from '../projections/projections.service';

/**
 * The lock is only worth anything if it stops a WRITE, so the assertion that
 * matters is the last one: with the month locked, the projection patch that
 * succeeds a line earlier must fail. The Data page's old toggle passed every
 * check you could make about the button and froze nothing.
 */
const admin = (tid: string, roleKey: string): RequestUser => ({
  userId: `user_admin_${roleKey}`,
  tenantId: tid,
  roleId: `role_admin_${roleKey}`,
});

const ACME = 'tenant_acme';
const PERIOD = '2026-08';

describe('PeriodLocksService (integration)', () => {
  let prisma: PrismaService;
  let locks: PeriodLocksService;
  let projections: ProjectionsService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    locks = new PeriodLocksService(prisma);
    projections = new ProjectionsService(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  afterEach(async () => {
    // Every test starts from "not locked", whatever it did.
    await locks.unlock(admin(ACME, 'acme'), PERIOD).catch(() => undefined);
  });

  it('reports no locks on a fresh tenant', async () => {
    expect(await locks.list(admin(ACME, 'acme'), {})).toEqual([]);
  });

  it('records who locked the period and when', async () => {
    const row = await locks.lock(admin(ACME, 'acme'), {
      period: PERIOD,
      reason: 'August close',
    });
    expect(row.period).toBe(PERIOD);
    expect(row.reason).toBe('August close');
    expect(row.lockedById).toBe('user_admin_acme');
    expect(row.lockedByName).toBeTruthy();
  });

  it('refuses to re-lock rather than reassigning the lock', async () => {
    await locks.lock(admin(ACME, 'acme'), { period: PERIOD });
    await expect(
      locks.lock(admin(ACME, 'acme'), { period: PERIOD }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not leak one tenant lock into another', async () => {
    await locks.lock(admin(ACME, 'acme'), { period: PERIOD });
    const other = await locks.list(admin('tenant_globex', 'globex'), {});
    expect(other).toEqual([]);
  });

  it('freezes projection edits for the locked period, and thaws them again', async () => {
    const user = admin(ACME, 'acme');
    const { lines } = await projections.list(user, {
      period: PERIOD,
      lineFilter: 'all',
    });
    const target = lines[0];
    expect(target).toBeDefined();

    // Unlocked: the write goes through.
    const before = await projections.update(user, target.id, {
      committedQty: 1234,
    });
    expect(before.committedQty).toBe(1234);

    await locks.lock(user, { period: PERIOD, reason: 'August close' });

    // Locked: the same write is refused — for an admin, not just for sales.
    await expect(
      projections.update(user, target.id, { committedQty: 4321 }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // And the row is untouched, not partially applied.
    const after = await projections.list(user, {
      period: PERIOD,
      lineFilter: 'all',
    });
    expect(after.lines[0].committedQty).toBe(1234);

    await locks.unlock(user, PERIOD);
    const thawed = await projections.update(user, target.id, {
      committedQty: 4321,
    });
    expect(thawed.committedQty).toBe(4321);
  });
});
