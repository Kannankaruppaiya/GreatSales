import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { execSync } from 'node:child_process';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

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

describe('OrdersService (integration)', () => {
  let prisma: PrismaService;
  let service: OrdersService;

  beforeAll(async () => {
    execSync('pnpm --filter @greatsales/db db:seed', {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    service = new OrdersService(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('returns the seeded Acme order enriched with items and history', async () => {
    const res = await service.list(admin('tenant_acme', 'acme'), { limit: 20 });

    expect(res.items).toHaveLength(1);
    const o = res.items[0];
    expect(o.code).toBe('SO-ACME-001');
    expect(o.customerName).toBe('Acme Corp Customer One');
    expect(o.salespersonName).toBe('Acme Corp Sales One');
    expect(o.status).toBe('Acknowledged');
    expect(o.total).toBe(100000);
    expect(o.items).toHaveLength(1);
    expect(o.items[0].productName).toBe('Product A');
    expect(o.items[0].lineTotal).toBe(100000);
    expect(o.statusHistory).toHaveLength(1);
    expect(o.statusHistory[0].changedByName).toBe('Acme Corp Sales One');
  });

  it('isolates tenants — Globex admin never sees Acme orders (RLS)', async () => {
    const res = await service.list(admin('tenant_globex', 'globex'), {
      limit: 20,
    });
    expect(res.items.every((o) => !o.code.includes('ACME'))).toBe(true);
    expect(res.items[0]?.code).toBe('SO-GLOBEX-001');
  });

  it('scopes a salesperson to their own orders only', async () => {
    const owner = await service.list(sales('tenant_acme', 'acme', 1), {
      limit: 20,
    });
    expect(owner.items).toHaveLength(1);
    const other = await service.list(sales('tenant_acme', 'acme', 2), {
      limit: 20,
    });
    expect(other.items).toHaveLength(0);
  });

  it('creates an order and computes total from the line items', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      code: 'SO-ACME-TEST-1',
      customerId: 'cust_1_acme',
      salespersonId: 'user_sales1_acme',
      items: [
        { productId: 'prod_a_acme', qty: 10, price: 100 },
        { productId: 'prod_b_acme', qty: 2, price: 250 },
      ],
    });
    expect(created.total).toBe(1500);
    expect(created.status).toBe('Created'); // DB default
    expect(created.items).toHaveLength(2);
    expect(created.statusHistory).toHaveLength(1); // initial entry
    expect(created.createdById).toBe('user_admin_acme');
  });

  it('appends a status-history entry on a status change', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const id = list.items.find((o) => o.code === 'SO-ACME-001')!.id;
    const before = list.items.find((o) => o.code === 'SO-ACME-001')!
      .statusHistory.length;

    const updated = await service.update(admin('tenant_acme', 'acme'), id, {
      status: 'DeliveredToCustomer',
      statusNote: 'Handed to customer',
    });
    expect(updated.status).toBe('DeliveredToCustomer');
    expect(updated.statusHistory).toHaveLength(before + 1);
    expect(updated.statusHistory.at(-1)!.note).toBe('Handed to customer');
  });

  it('records cancellation reason and timestamp when cancelled', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const id = list.items.find((o) => o.code === 'SO-ACME-TEST-1')!.id;

    const cancelled = await service.update(admin('tenant_acme', 'acme'), id, {
      status: 'Cancelled',
      cancelReason: 'Customer withdrew',
    });
    expect(cancelled.status).toBe('Cancelled');
    expect(cancelled.cancelReason).toBe('Customer withdrew');
    expect(cancelled.cancelledAt).not.toBeNull();
  });

  it('forbids a salesperson from editing another salesperson order', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const id = list.items.find((o) => o.code === 'SO-ACME-001')!.id;
    await expect(
      service.update(sales('tenant_acme', 'acme', 2), id, { isUrgent: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('soft-deletes an order so it drops out of the list', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      code: 'SO-ACME-DOOM',
      customerId: 'cust_1_acme',
      salespersonId: 'user_sales1_acme',
      items: [{ productId: 'prod_a_acme', qty: 1, price: 1 }],
    });
    await service.remove(admin('tenant_acme', 'acme'), created.id);
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    expect(list.items.some((o) => o.id === created.id)).toBe(false);
    await expect(
      service.update(admin('tenant_acme', 'acme'), created.id, {
        isUrgent: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
