import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { DashboardQuerySchema, type RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionsService } from '../projections/projections.service';
import { TargetsService } from '../targets/targets.service';
import { LeadsService } from '../leads/leads.service';
import { DashboardService } from './dashboard.service';

/**
 * F11 — the dashboard aggregate.
 *
 * The risk this slice carries is not that the endpoint fails; it is that it
 * QUIETLY DISAGREES with the pages it summarises. So the assertions below are
 * mostly cross-checks: the aggregate's numbers are recomputed here from the
 * projections and leads services directly, and must match exactly.
 */
const TENANT = 'tenant_acme';
const PERIOD = '2026-08';

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
    projections = new ProjectionsService(prisma);
    leads = new LeadsService(prisma);
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
      const dash = await service.overview(admin, { period: PERIOD });

      // If these ever diverge, one of them is lying to the sales team.
      expect(dash.kpis.recurringCommitted).toBe(worksheet.summary.totCommitted);
      expect(dash.kpis.recurringAchieved).toBe(worksheet.summary.totAchieved);
      expect(dash.kpis.recurringPct).toBe(worksheet.summary.totPct);
    });

    it('reports the same new-sales totals as the leads list', async () => {
      const all = await leads.allInScope(admin);
      const dead = ['ClosedLost', 'NoRequirementOrCold'];
      const expectedCommitted = all
        .filter((l) => !dead.includes(l.stage))
        .reduce((s, l) => s + l.totalValue, 0);
      const expectedAchieved = all
        .filter((l) => l.stage === 'ClosedWon')
        .reduce((s, l) => s + l.totalValue, 0);

      const dash = await service.overview(admin, { period: PERIOD });

      expect(dash.kpis.newSalesCommitted).toBe(expectedCommitted);
      expect(dash.kpis.newSalesAchieved).toBe(expectedAchieved);
    });

    it('totals are the sum of their halves, and the percentage follows', async () => {
      const d = await service.overview(admin, { period: PERIOD });

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
      const d = await service.overview(admin, { period: PERIOD });
      const summed = d.bySalesperson.reduce((s, r) => s + r.committed, 0);

      // A breakdown that does not reconcile with its own headline is worse
      // than no breakdown — it looks authoritative and is not.
      expect(summed).toBeCloseTo(d.kpis.totalCommitted, 6);
    });
  });

  describe('shape', () => {
    it('always returns the four categories in a fixed order', async () => {
      const d = await service.overview(admin, { period: PERIOD });

      expect(d.byCategory.map((c) => c.tier)).toEqual([
        'Platinum',
        'Gold',
        'Silver',
        'Brass',
      ]);
    });

    it('caps the top open projections and sorts them by value', async () => {
      const d = await service.overview(admin, { period: PERIOD });

      expect(d.topOpenProjections.length).toBeLessThanOrEqual(10);
      const values = d.topOpenProjections.map((p) => p.projValue);
      expect([...values].sort((a, b) => b - a)).toEqual(values);
    });

    it('excludes finished projection lines from the open list', async () => {
      const closed = ['Confirmed', 'Completed', 'Lost', 'Cancelled'];
      const d = await service.overview(admin, { period: PERIOD });

      expect(
        d.topOpenProjections.filter((p) => closed.includes(p.status)),
      ).toEqual([]);
    });

    it('reports the true oral-confirmation count even when the list is capped', async () => {
      const d = await service.overview(admin, { period: PERIOD });

      expect(d.oralConfirmationDeals.length).toBeLessThanOrEqual(
        d.oralConfirmationTotal,
      );
      expect(
        d.oralConfirmationDeals.every(
          (l) => l.stage === 'NegotiationOralConfirmation',
        ),
      ).toBe(true);
    });

    it('rejects a period that is not YYYY-MM at the contract, not in a query', () => {
      expect(DashboardQuerySchema.safeParse({ period: 'August' }).success).toBe(
        false,
      );
      expect(
        DashboardQuerySchema.safeParse({ period: '2026-08' }).success,
      ).toBe(true);
    });
  });

  describe('scope', () => {
    it('shows a sales user only their own numbers', async () => {
      const asSales = await service.overview(sales1, { period: PERIOD });
      const asAdmin = await service.overview(admin, { period: PERIOD });

      // Their own view must not exceed the tenant's, and must be attributed
      // only to them.
      expect(asSales.kpis.totalCommitted).toBeLessThanOrEqual(
        asAdmin.kpis.totalCommitted,
      );
      expect(asSales.bySalesperson.map((r) => r.id)).toEqual([sales1.userId]);
    });

    it('ignores an ownerId a sales user asks for', async () => {
      const own = await service.overview(sales1, { period: PERIOD });
      const spoofed = await service.overview(sales1, {
        period: PERIOD,
        ownerId: 'user_sales2_acme',
      });

      expect(spoofed.kpis.totalCommitted).toBe(own.kpis.totalCommitted);
      expect(spoofed.bySalesperson.map((r) => r.id)).toEqual([sales1.userId]);
    });
  });
});
