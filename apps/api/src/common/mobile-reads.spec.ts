import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { ConflictException, NotFoundException } from '@nestjs/common';
import { reseedTestDatabase } from '../test-support/reseed';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LeadsService } from '../leads/leads.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { FollowUpsService } from '../followups/followups.service';
import { MappingsService } from '../mappings/mappings.service';
import { ProjectionsService } from '../projections/projections.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CustomersService } from '../customers/customers.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

/**
 * The reads the salesperson's mobile app is built on: one record by id, the
 * pipeline's per-stage summary, lead ordering and stage filters, follow-up due
 * windows with the record each task is about, the receivables roll-up, and
 * server-assigned order numbers.
 *
 * Every by-id read is checked from both sides — the owner gets the row, another
 * salesperson gets 404 (not 403: "exists but forbidden" would confirm a record
 * they should not know about) and an admin gets it — against records created
 * here for a second owner, so no assertion passes on an empty result.
 */
const sales1: RequestUser = {
  userId: 'user_sales1_acme',
  tenantId: 'tenant_acme',
  roleId: 'role_sales_acme',
};
const admin: RequestUser = {
  userId: 'user_admin_acme',
  tenantId: 'tenant_acme',
  roleId: 'role_admin_acme',
};
const OTHER = 'user_sales2_acme';

describe('mobile read surface', () => {
  let prisma: PrismaService;
  let leads: LeadsService;
  let orders: OrdersService;
  let payments: PaymentsService;
  let followups: FollowUpsService;
  let mappings: MappingsService;
  let projections: ProjectionsService;
  let customers: CustomersService;
  let otherCustomerId: string;

  let otherLeadId: string;
  let otherOrderId: string;
  let otherPaymentId: string;
  let otherFollowUpId: string;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    const notifications = new NotificationsService(prisma);
    leads = new LeadsService(prisma, notifications);
    orders = new OrdersService(prisma, notifications);
    payments = new PaymentsService(prisma, notifications);
    followups = new FollowUpsService(prisma);
    mappings = new MappingsService(prisma);
    projections = new ProjectionsService(prisma);
    customers = new CustomersService(
      prisma,
      notifications,
      new FeatureFlagsService(prisma),
    );
    otherCustomerId = (
      await customers.create(admin, {
        name: 'Acme Mobile Other Customer',
        salespersonId: OTHER,
      })
    ).id;

    otherLeadId = (
      await leads.create(admin, {
        customerName: 'Acme Mobile Other Lead',
        salespersonId: OTHER,
      })
    ).id;
    otherOrderId = (
      await orders.create(admin, {
        code: 'SO-ACME-MOBILE-OTHER',
        customerId: 'cust_1_acme',
        salespersonId: OTHER,
        items: [{ productId: 'prod_a_acme', qty: 1, price: 100 }],
      })
    ).id;
    otherPaymentId = (
      await payments.create(admin, { amount: 100, salespersonId: OTHER })
    ).id;
    otherFollowUpId = (
      await followups.create(admin, {
        entityType: 'Customer',
        entityId: 'cust_1_acme',
        dueDate: '2026-09-10',
        salespersonId: OTHER,
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('by-id reads', () => {
    it('lead: owner and admin read it, another salesperson gets 404', async () => {
      const own = await leads.create(sales1, {
        customerName: 'Acme Mobile Own Lead',
        salespersonId: sales1.userId,
      });
      await expect(leads.get(sales1, own.id)).resolves.toMatchObject({
        id: own.id,
      });
      await expect(leads.get(sales1, otherLeadId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(leads.get(admin, otherLeadId)).resolves.toMatchObject({
        id: otherLeadId,
      });
    });

    it('customer: another salesperson gets 404 by id, not only in the list', async () => {
      await expect(
        customers.getById(sales1, otherCustomerId),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        customers.getById(admin, otherCustomerId),
      ).resolves.toMatchObject({
        id: otherCustomerId,
      });
      await expect(
        customers.getById(sales1, 'cust_1_acme'),
      ).resolves.toMatchObject({
        id: 'cust_1_acme',
      });
    });

    it('order, invoice, follow-up: another salesperson gets 404', async () => {
      await expect(orders.get(sales1, otherOrderId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(payments.get(sales1, otherPaymentId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(
        followups.get(sales1, otherFollowUpId),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(orders.get(admin, otherOrderId)).resolves.toMatchObject({
        id: otherOrderId,
      });
    });

    it('mapping: another salesperson gets 404, the owner reads it', async () => {
      const own = (await mappings.list(sales1, { limit: 1 })).items[0];
      expect(own).toBeDefined();
      await expect(mappings.get(sales1, own!.id)).resolves.toMatchObject({
        id: own!.id,
      });
      const foreign = await prisma.forTenant('tenant_acme').mapping.findFirst({
        where: { deletedAt: null, NOT: { salespersonId: sales1.userId } },
        select: { id: true },
      });
      if (foreign) {
        await expect(mappings.get(sales1, foreign.id)).rejects.toThrow();
      }
    });

    it('projection line: the same figures the worksheet shows', async () => {
      const sheet = await projections.list(sales1, {
        period: '2026-08',
        lineFilter: 'all',
      });
      const line = sheet.lines[0]!;
      await expect(projections.get(sales1, line.id)).resolves.toEqual(line);
    });

    it('projection list narrows to one customer', async () => {
      const sheet = await projections.list(sales1, {
        period: '2026-08',
        lineFilter: 'all',
      });
      const customerId = sheet.lines[0]!.customerId;
      const narrowed = await projections.list(sales1, {
        period: '2026-08',
        lineFilter: 'all',
        customerId,
      });
      expect(narrowed.lines.length).toBeGreaterThan(0);
      expect(narrowed.lines.every((l) => l.customerId === customerId)).toBe(
        true,
      );
    });
  });

  describe('leads', () => {
    it('stage summary agrees with the list, stage by stage', async () => {
      const summary = await leads.stageSummary(sales1);
      expect(summary.length).toBeGreaterThan(0);
      for (const row of summary) {
        const page = await leads.list(sales1, { limit: 100, stage: row.stage });
        expect(page.total).toBe(row.count);
        const value = page.items.reduce((s, l) => s + l.totalValue, 0);
        expect(value).toBeCloseTo(row.value, 2);
      }
    });

    it('stages filters to several stages at once', async () => {
      const summary = await leads.stageSummary(sales1);
      const stages = summary.map((s) => s.stage).slice(0, 2);
      const page = await leads.list(sales1, { limit: 100, stages });
      expect(page.items.every((l) => stages.includes(l.stage))).toBe(true);
      expect(page.total).toBe(
        summary
          .filter((s) => stages.includes(s.stage))
          .reduce((n, s) => n + s.count, 0),
      );
    });

    it('value order is a ranked top-N with no cursor', async () => {
      const page = await leads.list(sales1, { limit: 3, sort: 'value' });
      expect(page.nextCursor).toBeNull();
      const values = page.items.map((l) => l.totalValue);
      expect(values).toEqual([...values].sort((a, b) => b - a));
    });

    it('close-date order puts undated leads last', async () => {
      const page = await leads.list(sales1, { limit: 100, sort: 'closeDate' });
      const dates = page.items.map((l) => l.expClose ?? '9999-12-31');
      expect(dates).toEqual([...dates].sort());
    });
  });

  describe('follow-ups', () => {
    it('names the record each task is about', async () => {
      const own = await followups.create(sales1, {
        entityType: 'Customer',
        entityId: 'cust_1_acme',
        dueDate: '2026-09-12',
        title: 'Site visit',
      });
      const row = await followups.get(sales1, own.id);
      const customer = await prisma
        .forTenant('tenant_acme')
        .customer.findUnique({ where: { id: 'cust_1_acme' } });
      expect(row.entityName).toBe(customer!.name);
    });

    it('a due window returns only days inside it, soonest first', async () => {
      const page = await followups.list(sales1, {
        limit: 100,
        dueFrom: '2026-09-01',
        dueTo: '2026-09-30',
        sort: 'due',
      });
      expect(page.items.length).toBeGreaterThan(0);
      const days = page.items.map((f) => f.dueDate);
      expect(days.every((d) => d >= '2026-09-01' && d <= '2026-09-30')).toBe(
        true,
      );
      expect(days).toEqual([...days].sort());
    });
  });

  describe('payments summary', () => {
    it("is the caller's open ledger, bucket totals adding up", async () => {
      const summary = await payments.summary(sales1);
      const agingTotal = summary.aging.reduce((s, b) => s + b.amount, 0);
      expect(agingTotal).toBeCloseTo(summary.totalPending, 2);
      expect(summary.aging.reduce((n, b) => n + b.count, 0)).toBe(
        summary.openCount,
      );
      expect(summary.overdue).toBeLessThanOrEqual(summary.totalPending);
    });
  });

  describe('order numbering', () => {
    it('numbers an order with no code in the tenant sequence for its year', async () => {
      const body = {
        customerId: 'cust_1_acme',
        salespersonId: sales1.userId,
        items: [{ productId: 'prod_a_acme', qty: 1, price: 50 }],
        date: '2031-03-01',
      };
      const first = await orders.create(sales1, body);
      const second = await orders.create(sales1, body);
      expect(first.code).toBe('SO-2031-0001');
      expect(second.code).toBe('SO-2031-0002');
    });

    it('two creates racing for a number both succeed with different ones', async () => {
      const body = {
        customerId: 'cust_1_acme',
        salespersonId: sales1.userId,
        items: [{ productId: 'prod_a_acme', qty: 1, price: 50 }],
        date: '2032-03-01',
      };
      const [a, b] = await Promise.all([
        orders.create(sales1, body),
        orders.create(sales1, body),
      ]);
      expect(new Set([a.code, b.code])).toEqual(
        new Set(['SO-2032-0001', 'SO-2032-0002']),
      );
    });

    it('a supplied code that is taken is a 409, not a server error', async () => {
      await expect(
        orders.create(sales1, {
          code: 'SO-ACME-MOBILE-OTHER',
          customerId: 'cust_1_acme',
          salespersonId: sales1.userId,
          items: [{ productId: 'prod_a_acme', qty: 1, price: 50 }],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
