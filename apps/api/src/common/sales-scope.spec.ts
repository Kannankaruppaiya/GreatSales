import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { LeadsService } from '../leads/leads.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { FollowUpsService } from '../followups/followups.service';
import { ProjectionsService } from '../projections/projections.service';

/**
 * Cross-module guarantee: a salesperson's scope is derived from their own
 * identity, never from request input. Passing another salesperson's id as
 * `ownerId` must not widen what they can see. Admin, by contrast, may filter.
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

describe('sales ownership scope (cross-module)', () => {
  let prisma: PrismaService;
  let customers: CustomersService;
  let leads: LeadsService;
  let orders: OrdersService;
  let payments: PaymentsService;
  let followups: FollowUpsService;
  let projections: ProjectionsService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    customers = new CustomersService(prisma);
    leads = new LeadsService(prisma);
    orders = new OrdersService(prisma);
    payments = new PaymentsService(prisma);
    followups = new FollowUpsService(prisma);
    projections = new ProjectionsService(prisma);

    // The base seed only owns records by sales1 (user_sales1_acme). Create one
    // record per module owned by OTHER (user_sales2_acme) as admin, so the
    // ownerId guard is exercised against real cross-owner data — without this,
    // the "ignores ownerId" assertions below would pass vacuously on an
    // empty result set even under a broken guard.
    await customers.create(admin, {
      name: 'Acme Other Owner Customer',
      salespersonId: OTHER,
    });
    await leads.create(admin, {
      customerName: 'Acme Other Owner Lead',
      salespersonId: OTHER,
    });
    await orders.create(admin, {
      code: 'SO-ACME-OTHER-001',
      customerId: 'cust_1_acme',
      salespersonId: OTHER,
      items: [{ productId: 'prod_a_acme', qty: 1, price: 100 }],
    });
    await payments.create(admin, {
      amount: 100,
      salespersonId: OTHER,
    });
    await followups.create(admin, {
      entityType: 'Customer',
      entityId: 'cust_1_acme',
      dueDate: '2026-09-01',
      salespersonId: OTHER,
    });
    // The base seed has no FollowUp rows at all (only a distinct
    // PaymentFollowup), so also give sales1 one of their own to list.
    await followups.create(sales1, {
      entityType: 'Customer',
      entityId: 'cust_1_acme',
      dueDate: '2026-09-15',
    });
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('ignores an explicit ownerId naming another salesperson', async () => {
    const [c, l, o, p, f] = await Promise.all([
      customers.list(sales1, { limit: 50, ownerId: OTHER }),
      leads.list(sales1, { limit: 50, ownerId: OTHER }),
      orders.list(sales1, { limit: 50, ownerId: OTHER }),
      payments.list(sales1, { limit: 50, ownerId: OTHER }),
      followups.list(sales1, { limit: 50, ownerId: OTHER }),
    ]);

    expect(c.items.length).toBeGreaterThan(0);
    expect(l.items.length).toBeGreaterThan(0);
    expect(o.items.length).toBeGreaterThan(0);
    expect(p.items.length).toBeGreaterThan(0);
    expect(f.items.length).toBeGreaterThan(0);

    expect(c.items.every((x) => x.salespersonId === sales1.userId)).toBe(true);
    expect(l.items.every((x) => x.salespersonId === sales1.userId)).toBe(true);
    expect(o.items.every((x) => x.salespersonId === sales1.userId)).toBe(true);
    expect(p.items.every((x) => x.salespersonId === sales1.userId)).toBe(true);
    expect(f.items.every((x) => x.salespersonId === sales1.userId)).toBe(true);
  });

  it('ignores an explicit ownerId on the projections worksheet', async () => {
    const res = await projections.list(sales1, {
      period: '2026-08',
      lineFilter: 'all',
      ownerId: OTHER,
    });
    expect(res.lines.length).toBeGreaterThan(0);
    expect(res.lines.every((l) => l.salespersonId === sales1.userId)).toBe(
      true,
    );
  });

  it('still honours ownerId for an admin caller', async () => {
    const res = await customers.list(admin, { limit: 50, ownerId: OTHER });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((x) => x.salespersonId === OTHER)).toBe(true);
  });
});
