import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import {
  DashboardQuerySchema,
  resolveRange,
  type RequestUser,
} from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionsService } from '../projections/projections.service';
import { TargetsService } from '../targets/targets.service';
import { LeadsService } from '../leads/leads.service';
import { DashboardService } from './dashboard.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * F11 — the dashboard aggregate.
 *
 * The risk this slice carries is not that the endpoint fails; it is that it
 * QUIETLY DISAGREES with the pages it summarises. So the assertions below are
 * mostly cross-checks: the aggregate's numbers are recomputed here from the
 * projections and leads services directly, and must match exactly.
 *
 * It now answers for a WINDOW rather than a month, and the second risk is that
 * the window does nothing — which is what the month dropdown was doing before
 * this, since the new-sales half ignored the period entirely and showed the
 * same pipeline total under every month. Several tests below exist only to
 * prove that a day, a week, a month and a year give different answers.
 */
const TENANT = 'tenant_acme';
const PERIOD = '2026-08';
/** The fixture month, as the window the API actually takes. */
const MONTH = resolveRange('month', `${PERIOD}-15`);
const win = (from: string, to: string) => ({ from, to });

const admin: RequestUser = {
  userId: 'user_admin_acme',
  tenantId: TENANT,
  roleId: 'role_admin_acme',
};
const sales1: RequestUser = {
  userId: 'user_sales1_acme',
  tenantId: TENANT,
  roleId: 'role_sales_acme',
};

describe('DashboardService', () => {
  let prisma: PrismaService;
  let projections: ProjectionsService;
  let leads: LeadsService;
  let targets: TargetsService;
  let service: DashboardService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    // Real, not a stub: notify() writes a row and swallows its own failures,
    // so a service under test behaves exactly as it does in the app.
    const notifications = new NotificationsService(prisma);
    projections = new ProjectionsService(prisma);
    leads = new LeadsService(prisma, notifications);
    targets = new TargetsService(prisma);
    service = new DashboardService(projections, leads, targets);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  describe('agrees with the pages it summarises', () => {
    it('reports the same recurring totals as the projections worksheet', async () => {
      const worksheet = await projections.list(admin, {
        period: PERIOD,
        lineFilter: 'all',
      });
      const dash = await service.overview(admin, win(MONTH.from, MONTH.to));

      // If these ever diverge, one of them is lying to the sales team.
      expect(dash.kpis.recurringCommitted).toBe(worksheet.summary.totCommitted);
      expect(dash.kpis.recurringAchieved).toBe(worksheet.summary.totAchieved);
      expect(dash.kpis.recurringPct).toBe(worksheet.summary.totPct);
    });

    it('reports the same new-sales totals as the leads list, for the window', async () => {
      const all = await leads.allInScope(admin);
      const dead = ['ClosedLost', 'NoRequirementOrCold'];
      const inside = (iso: string | null | undefined) =>
        !!iso && iso.slice(0, 10) >= MONTH.from && iso.slice(0, 10) <= MONTH.to;

      // Committed is what was RAISED in the window; achieved is what was WON in
      // it. Two different dates on purpose — a deal raised in June and won in
      // September belongs to June's intake and September's result.
      const expectedCommitted = all
        .filter((l) => !dead.includes(l.stage) && inside(l.createdAt))
        .reduce((s, l) => s + l.totalValue, 0);
      const expectedAchieved = all
        .filter(
          (l) =>
            l.stage === 'ClosedWon' && inside(l.stageUpdatedAt ?? l.updatedAt),
        )
        .reduce((s, l) => s + l.totalValue, 0);

      const dash = await service.overview(admin, win(MONTH.from, MONTH.to));

      expect(dash.kpis.newSalesCommitted).toBe(expectedCommitted);
      expect(dash.kpis.newSalesAchieved).toBe(expectedAchieved);
      // The fixtures put a lead and a won deal inside this month, so a passing
      // assertion of 0 === 0 cannot be what proved this.
      expect(expectedCommitted).toBeGreaterThan(0);
      expect(expectedAchieved).toBeGreaterThan(0);
    });

    it('totals are the sum of their halves, and the percentage follows', async () => {
      const d = await service.overview(admin, win(MONTH.from, MONTH.to));

      expect(d.kpis.totalCommitted).toBe(
        d.kpis.recurringCommitted + d.kpis.newSalesCommitted,
      );
      expect(d.kpis.totalAchieved).toBe(
        d.kpis.recurringAchieved + d.kpis.newSalesAchieved,
      );
      expect(d.kpis.totalPct).toBe(
        d.kpis.totalCommitted > 0
          ? (d.kpis.totalAchieved / d.kpis.totalCommitted) * 100
          : null,
      );
    });

    it('per-salesperson committed adds back up to the tenant total', async () => {
      const d = await service.overview(admin, win(MONTH.from, MONTH.to));
      const summed = d.bySalesperson.reduce((s, r) => s + r.committed, 0);

      // A breakdown that does not reconcile with its own headline is worse
      // than no breakdown — it looks authoritative and is not.
      expect(summed).toBeCloseTo(d.kpis.totalCommitted, 6);
    });
  });

  describe('shape', () => {
    it('always returns the four categories in a fixed order', async () => {
      const d = await service.overview(admin, win(MONTH.from, MONTH.to));

      expect(d.byCategory.map((c) => c.tier)).toEqual([
        'Platinum',
        'Gold',
        'Silver',
        'Brass',
      ]);
    });

    it('caps the top open projections and sorts them by value', async () => {
      const d = await service.overview(admin, win(MONTH.from, MONTH.to));

      expect(d.topOpenProjections.length).toBeLessThanOrEqual(10);
      const values = d.topOpenProjections.map((p) => p.projValue);
      expect([...values].sort((a, b) => b - a)).toEqual(values);
    });

    it('excludes finished projection lines from the open list', async () => {
      const closed = ['Confirmed', 'Completed', 'Lost', 'Cancelled'];
      const d = await service.overview(admin, win(MONTH.from, MONTH.to));

      expect(
        d.topOpenProjections.filter((p) => closed.includes(p.status)),
      ).toEqual([]);
    });

    it('reports the true oral-confirmation count even when the list is capped', async () => {
      const d = await service.overview(admin, win(MONTH.from, MONTH.to));

      expect(d.oralConfirmationDeals.length).toBeLessThanOrEqual(
        d.oralConfirmationTotal,
      );
      expect(
        d.oralConfirmationDeals.every(
          (l) => l.stage === 'NegotiationOralConfirmation',
        ),
      ).toBe(true);
    });

    it('rejects a bad window at the contract, not in a query', () => {
      const ok = (q: unknown) => DashboardQuerySchema.safeParse(q).success;

      expect(ok({ from: '2026-08-01', to: '2026-08-31' })).toBe(true);
      expect(ok({ from: 'August', to: '2026-08-31' })).toBe(false);
      // Shaped like a date and not one. Without the refinement this reaches
      // Prisma as a range matching nothing, which looks like an empty month.
      expect(ok({ from: '2026-13-40', to: '2026-13-41' })).toBe(false);
      // Backwards. Silently returns nothing otherwise, which reads as "no data"
      // rather than "you asked for an impossible window".
      expect(ok({ from: '2026-08-31', to: '2026-08-01' })).toBe(false);
      expect(ok({ from: '2026-08-01' })).toBe(false);
    });
  });

  describe('the window actually narrows the answer', () => {
    it('gives a day, a week, a month and a year different answers', async () => {
      // The fixtures raise one lead on the 10th and win another on the 20th.
      const tenth = resolveRange('day', '2026-08-10');
      const twentieth = resolveRange('day', '2026-08-20');
      const weekOfTenth = resolveRange('week', '2026-08-10');
      const year = resolveRange('year', '2026-08-10');

      const [d10, d20, w, m, y] = await Promise.all([
        service.overview(admin, win(tenth.from, tenth.to)),
        service.overview(admin, win(twentieth.from, twentieth.to)),
        service.overview(admin, win(weekOfTenth.from, weekOfTenth.to)),
        service.overview(admin, win(MONTH.from, MONTH.to)),
        service.overview(admin, win(year.from, year.to)),
      ]);

      // The 10th raised a lead and won nothing; the 20th won one and raised
      // nothing. A picker that gave both the same answer would be the bug this
      // replaced.
      expect(d10.kpis.newSalesCommitted).toBeGreaterThan(0);
      expect(d10.kpis.newSalesAchieved).toBe(0);
      expect(d20.kpis.newSalesAchieved).toBeGreaterThan(0);

      // Each window contains the last, so nothing may shrink as it widens.
      expect(w.kpis.newSalesCommitted).toBeGreaterThanOrEqual(
        d10.kpis.newSalesCommitted,
      );
      expect(m.kpis.newSalesCommitted).toBeGreaterThanOrEqual(
        w.kpis.newSalesCommitted,
      );
      expect(y.kpis.newSalesCommitted).toBeGreaterThanOrEqual(
        m.kpis.newSalesCommitted,
      );
    });

    it('reports nothing for a window the data does not reach', async () => {
      const quiet = resolveRange('month', '2019-04-15');
      const d = await service.overview(admin, win(quiet.from, quiet.to));

      expect(d.kpis.newSalesCommitted).toBe(0);
      expect(d.kpis.recurringCommitted).toBe(0);
      expect(d.kpis.totalPct).toBeNull();
    });

    it('answers for the months a window touches, and says which', async () => {
      const week = resolveRange('week', '2026-08-10');
      const d = await service.overview(admin, win(week.from, week.to));

      // A week is not a slice of a monthly commitment, so the recurring half is
      // that month's and the response says so rather than implying otherwise.
      expect(d.months).toEqual(['2026-08']);
      expect(d.from).toBe(week.from);
      expect(d.to).toBe(week.to);

      const year = resolveRange('year', '2026-08-10');
      const dy = await service.overview(admin, win(year.from, year.to));
      expect(dy.months).toHaveLength(12);
      expect(dy.months[0]).toBe('2026-01');
    });

    it('keeps the oral-confirmation list a snapshot, not a window figure', async () => {
      // "Which deals are at oral confirmation" is about where the pipeline
      // stands now. Scoping it to a day would empty a list whose whole job is
      // to be actionable today.
      const day = resolveRange('day', '2019-04-15');
      const quiet = await service.overview(admin, win(day.from, day.to));
      const month = await service.overview(admin, win(MONTH.from, MONTH.to));

      expect(quiet.oralConfirmationTotal).toBe(month.oralConfirmationTotal);
    });
  });

  describe('scope', () => {
    it('shows a sales user only their own numbers', async () => {
      const asSales = await service.overview(sales1, win(MONTH.from, MONTH.to));
      const asAdmin = await service.overview(admin, win(MONTH.from, MONTH.to));

      // Their own view must not exceed the tenant's, and must be attributed
      // only to them.
      expect(asSales.kpis.totalCommitted).toBeLessThanOrEqual(
        asAdmin.kpis.totalCommitted,
      );
      expect(asSales.bySalesperson.map((r) => r.id)).toEqual([sales1.userId]);
    });

    it('ignores an ownerId a sales user asks for', async () => {
      const own = await service.overview(sales1, win(MONTH.from, MONTH.to));
      const spoofed = await service.overview(sales1, {
        ...win(MONTH.from, MONTH.to),
        ownerId: 'user_sales2_acme',
      });

      expect(spoofed.kpis.totalCommitted).toBe(own.kpis.totalCommitted);
      expect(spoofed.bySalesperson.map((r) => r.id)).toEqual([sales1.userId]);
    });
  });
});
