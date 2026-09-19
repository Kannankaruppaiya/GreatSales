import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersService } from './customers.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

/**
 * Integration test against the real Dockerized Postgres via the RLS-bound app
 * role. Reseeds once for determinism, then exercises the service end-to-end:
 * enrichment, RLS tenant isolation, role scoping, and CRUD + soft-delete.
 */
const admin = (tid: string, roleKey: string): RequestUser => ({
  userId: `user_admin_${roleKey}`,
  tenantId: tid,
  roleId: `role_admin_${roleKey}`,
});
const sales = (tid: string, roleKey: string, n: 1 | 2): RequestUser => ({
  userId: `user_sales${n}_${roleKey}`,
  tenantId: tid,
  roleId: `role_sales_${roleKey}`,
});

describe('CustomersService (integration)', () => {
  let prisma: PrismaService;
  let service: CustomersService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    // Real, not a stub: notify() writes a row and swallows its own failures,
    // so a service under test behaves exactly as it does in the app.
    const notifications = new NotificationsService(prisma);
    const features = new FeatureFlagsService(prisma);
    service = new CustomersService(prisma, notifications, features);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('returns the seeded Acme customer enriched with names', async () => {
    const res = await service.list(admin('tenant_acme', 'acme'), { limit: 20 });

    expect(res.items).toHaveLength(1);
    const c = res.items[0];
    expect(c.name).toBe('Acme Corp Customer One');
    expect(c.category).toBe('Gold');
    expect(c.area).toBe('North');
    expect(c.outstanding).toBe(40000);
    expect(c.salespersonName).toBe('Acme Corp Sales One');
    expect(c.collectorName).toBe('Acme Corp Sales One');
    expect(c.industryName).toBe('Pharmaceutical');
    expect(c.primaryContactName).toBe('Primary Contact');
    expect(res.nextCursor).toBeNull();
  });

  it('isolates tenants — Globex admin never sees Acme customers (RLS)', async () => {
    const res = await service.list(admin('tenant_globex', 'globex'), {
      limit: 20,
    });
    expect(res.items.every((c) => !c.name.includes('Acme'))).toBe(true);
    expect(res.items[0]?.name).toBe('Globex Inc Customer One');
  });

  it('scopes a salesperson to their own customers only', async () => {
    const owner = await service.list(sales('tenant_acme', 'acme', 1), {
      limit: 20,
    });
    expect(owner.items).toHaveLength(1);

    const other = await service.list(sales('tenant_acme', 'acme', 2), {
      limit: 20,
    });
    expect(other.items).toHaveLength(0);
  });

  it('serves one customer by id, and hides another salesperson\'s behind a 404', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), { limit: 20 });
    const id = list.items[0].id;

    expect((await service.getById(admin('tenant_acme', 'acme'), id)).id).toBe(
      id,
    );
    expect(
      (await service.getById(sales('tenant_acme', 'acme', 1), id)).id,
    ).toBe(id);

    // Regression. getById filtered on tenant alone while list() also applied
    // resolveOwnerScope, so this call used to RETURN the account - a sales
    // role could read any customer in the tenant by asking for its id, and ids
    // travel through payment rows, follow-ups and shared links.
    await expect(
      service.getById(sales('tenant_acme', 'acme', 2), id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a customer and returns it enriched', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      name: 'Acme New Buyer',
      salespersonId: 'user_sales2_acme',
      category: 'Silver',
      outstanding: 1500,
    });
    expect(created.name).toBe('Acme New Buyer');
    expect(created.category).toBe('Silver');
    expect(created.outstanding).toBe(1500);
    expect(created.salespersonName).toBe('Acme Corp Sales Two');

    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    expect(list.items.some((c) => c.name === 'Acme New Buyer')).toBe(true);
  });

  it('forces a salesperson to own the customers they create', async () => {
    const created = await service.create(sales('tenant_acme', 'acme', 1), {
      name: 'Sales1 Self Customer',
      salespersonId: 'user_sales2_acme', // attempt to assign to someone else
    });
    // sales-only callers cannot hand a customer to another rep
    expect(created.salespersonId).toBe('user_sales1_acme');
  });

  it('updates a customer and returns the new values', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const id = list.items.find((c) => c.name === 'Acme Corp Customer One')!.id;

    const updated = await service.update(admin('tenant_acme', 'acme'), id, {
      category: 'Platinum',
      outstanding: 0,
    });
    expect(updated.category).toBe('Platinum');
    expect(updated.outstanding).toBe(0);
  });

  it('forbids a salesperson from editing another salesperson customer', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const id = list.items.find((c) => c.name === 'Acme Corp Customer One')!.id;

    await expect(
      service.update(sales('tenant_acme', 'acme', 2), id, { area: 'West' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('onboards a customer with its product mappings in one call', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      name: 'Onboarded With Products',
      salespersonId: 'user_sales1_acme',
      mappings: [
        { productId: 'prod_a_acme', customPrice: 123.5 },
        { productId: 'prod_b_acme' },
      ],
    });

    const db = prisma.forTenant('tenant_acme');
    const maps = await db.mapping.findMany({
      where: { customerId: created.id },
      orderBy: { productId: 'asc' },
    });
    expect(maps).toHaveLength(2);
    expect(maps[0].productId).toBe('prod_a_acme');
    expect(Number(maps[0].customPrice)).toBe(123.5);
    // Omitted price stays null so the catalog price applies.
    expect(maps[1].customPrice).toBeNull();
    // Mappings inherit the account's owner, not the caller.
    expect(maps.every((m) => m.salespersonId === 'user_sales1_acme')).toBe(
      true,
    );

    // No period was named, so nothing was opened on any worksheet.
    const lines = await db.projection.findMany({
      where: { mappingId: { in: maps.map((m) => m.id) } },
    });
    expect(lines).toHaveLength(0);
  });

  it('opens a blank worksheet line per mapping when a period is given', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      name: 'Onboarded Into A Month',
      salespersonId: 'user_sales1_acme',
      period: '2026-09',
      mappings: [{ productId: 'prod_a_acme', customPrice: 90 }],
    });

    const db = prisma.forTenant('tenant_acme');
    const map = await db.mapping.findFirstOrThrow({
      where: { customerId: created.id },
    });
    const line = await db.projection.findFirstOrThrow({
      where: { mappingId: map.id },
    });
    expect(line.period).toBe('2026-09');
    // Blank: present to be committed against, claiming nothing.
    expect(Number(line.committedQty)).toBe(0);
    expect(Number(line.achievedQty)).toBe(0);
    expect(line.status).toBe('ProjectionCreated');
    // The agreed price carries onto the line so it prices itself like the
    // mapping rather than falling through to the catalog.
    expect(Number(line.price)).toBe(90);
  });

  it('refuses to open lines in a locked month, and writes nothing at all', async () => {
    const db = prisma.forTenant('tenant_acme');
    await db.periodLock.create({
      data: {
        tenantId: 'tenant_acme',
        period: '2026-01',
        lockedById: 'user_admin_acme',
      },
    });

    await expect(
      service.create(admin('tenant_acme', 'acme'), {
        name: 'Into A Locked Month',
        salespersonId: 'user_sales1_acme',
        period: '2026-01',
        mappings: [{ productId: 'prod_a_acme' }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const orphan = await db.customer.findFirst({
      where: { name: 'Into A Locked Month' },
    });
    expect(orphan).toBeNull();

    await db.periodLock.deleteMany({ where: { period: '2026-01' } });
  });

  it('rejects an unknown product without creating the customer', async () => {
    await expect(
      service.create(admin('tenant_acme', 'acme'), {
        name: 'Bad Product Onboarding',
        salespersonId: 'user_sales1_acme',
        mappings: [
          { productId: 'prod_a_acme' },
          { productId: 'no_such_product' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const db = prisma.forTenant('tenant_acme');
    expect(
      await db.customer.findFirst({
        where: { name: 'Bad Product Onboarding' },
      }),
    ).toBeNull();
  });

  it("will not map another tenant's product, and rolls the customer back", async () => {
    await expect(
      service.create(admin('tenant_acme', 'acme'), {
        name: 'Cross Tenant Onboarding',
        salespersonId: 'user_sales1_acme',
        // Real row, wrong tenant. RLS must make it read as missing.
        mappings: [{ productId: 'prod_a_globex' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const db = prisma.forTenant('tenant_acme');
    expect(
      await db.customer.findFirst({
        where: { name: 'Cross Tenant Onboarding' },
      }),
    ).toBeNull();
  });

  /**
   * The same rule as payments and leads: owning a record proves who owns it
   * NOW, and `salespersonId` was writable on the patch that follows — so a rep
   * could push an account onto a colleague and out of their own book. Admin
   * still reassigns, which is what the bulk reassign flow runs as.
   */
  describe('a salesperson cannot give a customer away', () => {
    it('refuses a patch that names another salesperson', async () => {
      const own = await service.create(sales('tenant_acme', 'acme', 1), {
        name: 'Reassign Guard Co',
        salespersonId: 'user_sales1_acme',
      });
      await expect(
        service.update(sales('tenant_acme', 'acme', 1), own.id, {
          salespersonId: 'user_sales2_acme',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets an administrator reassign it', async () => {
      const own = await service.create(admin('tenant_acme', 'acme'), {
        name: 'Reassign Allowed Co',
        salespersonId: 'user_sales1_acme',
      });
      const moved = await service.update(admin('tenant_acme', 'acme'), own.id, {
        salespersonId: 'user_sales2_acme',
      });
      expect(moved.salespersonId).toBe('user_sales2_acme');
    });
  });

  it('soft-deletes a customer so it drops out of the list', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      name: 'Doomed Customer',
      salespersonId: 'user_sales1_acme',
    });
    await service.remove(admin('tenant_acme', 'acme'), created.id);

    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    expect(list.items.some((c) => c.id === created.id)).toBe(false);

    await expect(
      service.update(admin('tenant_acme', 'acme'), created.id, { area: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
