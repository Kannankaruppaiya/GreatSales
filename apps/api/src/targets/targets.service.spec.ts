import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TargetsService } from './targets.service';

/**
 * Monthly sales targets.
 *
 * Two things here are worth a test rather than a read-through. A sales user must
 * see only their own target — the read scope is part of the feature, not only
 * the write permission, because a target is a private figure between a person
 * and their manager. And the table is not tenant-scoped by its parent the way
 * LeadActivity was: it carries its own tenantId, so RLS is what stops one
 * workspace reading another's, and that is worth proving rather than assuming.
 */
const ACME = 'tenant_acme';
const GLOBEX = 'tenant_globex';
const PERIOD = '2026-08';

const admin = (tid: string, k: string): RequestUser => ({
  userId: `user_admin_${k}`,
  tenantId: tid,
  roleId: `role_admin_${k}`,
});
const sales = (tid: string, k: string, n: 1 | 2): RequestUser => ({
  userId: `user_sales${n}_${k}`,
  tenantId: tid,
  roleId: `role_sales_${k}`,
});

describe('TargetsService (integration)', () => {
  let prisma: PrismaService;
  let targets: TargetsService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    targets = new TargetsService(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('reads the seeded target for the month', async () => {
    const rows = await targets.list(admin(ACME, 'acme'), { period: PERIOD });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      salespersonId: 'user_sales1_acme',
      period: PERIOD,
      // A number on the wire, not a Decimal string — every other money field
      // on this API is a number and the dashboard adds this one to them.
      targetValue: 500000,
    });
    expect(typeof rows[0].targetValue).toBe('number');
  });

  it('shows a sales user their own target and nobody else’s', async () => {
    const own = await targets.list(sales(ACME, 'acme', 1), { period: PERIOD });
    expect(own.map((t) => t.salespersonId)).toEqual(['user_sales1_acme']);

    // Asking for a colleague's target is not an error; it is simply ignored,
    // the same way the dashboard forces ownerId to self.
    const asked = await targets.list(sales(ACME, 'acme', 2), {
      period: PERIOD,
      salespersonId: 'user_sales1_acme',
    });
    expect(asked).toEqual([]);
  });

  it('does not leak another tenant’s targets', async () => {
    const acme = await targets.list(admin(ACME, 'acme'), { period: PERIOD });
    const globex = await targets.list(admin(GLOBEX, 'globex'), {
      period: PERIOD,
    });
    expect(acme[0].salespersonId).toBe('user_sales1_acme');
    expect(globex[0].salespersonId).toBe('user_sales1_globex');
  });

  it('sets a target where there was none, then replaces it', async () => {
    const person = 'user_sales2_acme';
    const created = await targets.upsert(admin(ACME, 'acme'), {
      salespersonId: person,
      period: PERIOD,
      targetValue: 250000,
    });
    expect(created.targetValue).toBe(250000);

    const replaced = await targets.upsert(admin(ACME, 'acme'), {
      salespersonId: person,
      period: PERIOD,
      targetValue: 300000,
    });
    // The same row, not a second one: (salespersonId, period) is unique, so
    // "set August for this person" has exactly one meaning.
    expect(replaced.id).toBe(created.id);
    expect(replaced.targetValue).toBe(300000);

    await targets.remove(admin(ACME, 'acme'), created.id);
    const left = await targets.list(admin(ACME, 'acme'), { period: PERIOD });
    expect(left.map((t) => t.salespersonId)).not.toContain(person);
  });

  it('refuses a target for somebody outside the workspace', async () => {
    await expect(
      targets.upsert(admin(ACME, 'acme'), {
        salespersonId: 'user_sales1_globex',
        period: PERIOD,
        targetValue: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports a missing target as missing rather than deleting nothing', async () => {
    await expect(
      targets.remove(admin(ACME, 'acme'), 'tgt_does_not_exist'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sums the months a window covers, and says null when there is none', async () => {
    const august = await targets.totalFor(admin(ACME, 'acme'), [PERIOD]);
    expect(august.total).toBe(500000);
    expect(august.byPerson.get('user_sales1_acme')).toBe(500000);

    // A year-long window covers twelve months; a person with a target in only
    // one of them contributes only that one.
    const wholeYear = await targets.totalFor(
      admin(ACME, 'acme'),
      Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`),
    );
    expect(wholeYear.total).toBe(500000);

    // Null, not zero. An unset window must not render as a met one.
    const quiet = await targets.totalFor(admin(ACME, 'acme'), ['2026-01']);
    expect(quiet.total).toBeNull();
    expect((await targets.totalFor(admin(ACME, 'acme'), [])).total).toBeNull();
  });
});
