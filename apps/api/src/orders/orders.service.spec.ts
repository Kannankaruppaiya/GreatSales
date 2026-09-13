import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';
import { NotificationsService } from '../notifications/notifications.service';

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
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    // Real, not a stub: notify() writes a row and swallows its own failures,
    // so a service under test behaves exactly as it does in the app.
    const notifications = new NotificationsService(prisma);
    service = new OrdersService(prisma, notifications);
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

    // One rung at a time: SO-ACME-001 is Acknowledged, so the delivery partner
    // is the next legal move. It used to be possible to name any status here.
    const updated = await service.update(admin('tenant_acme', 'acme'), id, {
      status: 'DeliveryPartnerAssigned',
      statusNote: 'Handed to the transporter',
    });
    expect(updated.status).toBe('DeliveryPartnerAssigned');
    expect(updated.statusHistory).toHaveLength(before + 1);
    expect(updated.statusHistory.at(-1)!.note).toBe(
      'Handed to the transporter',
    );
  });

  it('refuses a status that skips a rung of the ladder', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const order = list.items.find((o) => o.code === 'SO-ACME-001')!;
    // Now at DeliveryPartnerAssigned, thanks to the test above.
    await expect(
      service.update(admin('tenant_acme', 'acme'), order.id, {
        status: 'CustomerReceiptConfirmed',
      }),
    ).rejects.toThrow(/cannot move from/i);
  });

  it('allows one rung back, so a mis-click does not cost the order', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const order = list.items.find((o) => o.code === 'SO-ACME-001')!;
    const back = await service.update(admin('tenant_acme', 'acme'), order.id, {
      status: 'Acknowledged',
      statusNote: 'Assigned in error',
    });
    expect(back.status).toBe('Acknowledged');
  });

  it('refuses to create an order that is already delivered', async () => {
    await expect(
      service.create(admin('tenant_acme', 'acme'), {
        code: 'SO-ACME-BORN-DELIVERED',
        customerId: 'cust_1_acme',
        salespersonId: 'user_sales1_acme',
        status: 'DeliveredToCustomer',
        items: [{ productId: 'prod_a_acme', qty: 1, price: 1 }],
      }),
    ).rejects.toThrow(/starts at Created/i);
  });

  it('replaces the line items of a draft order and recomputes the total', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      code: 'SO-ACME-ITEMS-1',
      customerId: 'cust_1_acme',
      salespersonId: 'user_sales1_acme',
      items: [{ productId: 'prod_a_acme', qty: 10, price: 100 }],
    });
    expect(created.total).toBe(1000);

    const edited = await service.update(
      admin('tenant_acme', 'acme'),
      created.id,
      {
        items: [
          { productId: 'prod_a_acme', qty: 4, price: 100 },
          { productId: 'prod_b_acme', qty: 2, price: 50 },
        ],
      },
    );
    expect(edited.items).toHaveLength(2);
    // Server-computed from the new lines, never taken from the client.
    expect(edited.total).toBe(500);
  });

  it('refuses to rewrite the line items once the order is acknowledged', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const order = list.items.find((o) => o.code === 'SO-ACME-001')!;
    await expect(
      service.update(admin('tenant_acme', 'acme'), order.id, {
        items: [{ productId: 'prod_a_acme', qty: 1, price: 1 }],
      }),
    ).rejects.toThrow(/still Created/i);
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

  it('links the order back to the projection line it was raised from', async () => {
    const db = prisma.forTenant('tenant_acme');
    const line = await db.projection.findFirstOrThrow({
      where: { mappingId: 'map_1_acme', period: '2026-08' },
    });
    expect(line.salesOrderId).toBeNull();

    const created = await service.create(admin('tenant_acme', 'acme'), {
      code: 'SO-FROM-PROJ-1',
      customerId: 'cust_1_acme',
      salespersonId: 'user_sales1_acme',
      items: [{ productId: 'prod_a_acme', qty: 5, price: 100 }],
      projectionId: line.id,
    });

    const after = await db.projection.findUniqueOrThrow({
      where: { id: line.id },
    });
    expect(after.salesOrderId).toBe(created.id);

    // And the worksheet now reports the order's real status rather than a
    // label somebody typed into the status column.
    const relinked = await db.projection.findFirstOrThrow({
      where: { id: line.id },
      include: { salesOrder: true },
    });
    expect(relinked.salesOrder?.status).toBe('Created');
  });

  it('refuses a second order for the same projection line', async () => {
    const db = prisma.forTenant('tenant_acme');
    const line = await db.projection.findFirstOrThrow({
      where: { mappingId: 'map_1_acme', period: '2026-08' },
    });
    expect(line.salesOrderId).not.toBeNull();

    await expect(
      service.create(admin('tenant_acme', 'acme'), {
        code: 'SO-FROM-PROJ-2',
        customerId: 'cust_1_acme',
        salespersonId: 'user_sales1_acme',
        items: [{ productId: 'prod_a_acme', qty: 1, price: 100 }],
        projectionId: line.id,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    // Nothing partial left behind: the refused order was never written.
    expect(
      await db.salesOrder.findFirst({ where: { code: 'SO-FROM-PROJ-2' } }),
    ).toBeNull();
  });

  it('lets a line be re-ordered after its order was cancelled', async () => {
    // The worksheet already treats a cancelled link as no link and offers
    // "Create SO" again. Refusing here made that button lie, and the line
    // could not be removed either — so a cancelled order left the line stuck
    // with no way forward and no way out.
    const db = prisma.forTenant('tenant_acme');
    const line = await db.projection.findFirstOrThrow({
      where: { mappingId: 'map_1_acme', period: '2026-08' },
    });
    const firstOrderId = line.salesOrderId as string;
    expect(firstOrderId).not.toBeNull();

    await service.update(admin('tenant_acme', 'acme'), firstOrderId, {
      status: 'Cancelled',
      cancelReason: 'Customer withdrew the PO',
    });

    // Removable again — the cancelled order no longer holds the line.
    const replacement = await service.create(admin('tenant_acme', 'acme'), {
      code: 'SO-AFTER-CANCEL',
      customerId: 'cust_1_acme',
      salespersonId: 'user_sales1_acme',
      items: [{ productId: 'prod_a_acme', qty: 2, price: 100 }],
      projectionId: line.id,
    });

    const after = await db.projection.findUniqueOrThrow({
      where: { id: line.id },
    });
    expect(after.salesOrderId).toBe(replacement.id);
    expect(after.salesOrderId).not.toBe(firstOrderId);
  });

  it("will not link another tenant's projection line", async () => {
    const globexLine = await prisma
      .forTenant('tenant_globex')
      .projection.findFirstOrThrow({ where: { mappingId: 'map_1_globex' } });

    await expect(
      service.create(admin('tenant_acme', 'acme'), {
        code: 'SO-CROSS-TENANT',
        customerId: 'cust_1_acme',
        salespersonId: 'user_sales1_acme',
        items: [{ productId: 'prod_a_acme', qty: 1, price: 100 }],
        projectionId: globexLine.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(
      await prisma
        .forTenant('tenant_acme')
        .salesOrder.findFirst({ where: { code: 'SO-CROSS-TENANT' } }),
    ).toBeNull();
  });

  it('refuses to raise an order from a line in a locked month', async () => {
    const db = prisma.forTenant('tenant_acme');
    // A fresh line, so this does not depend on the one linked above.
    const mapping = await db.mapping.findFirstOrThrow({
      where: { id: 'map_1_acme' },
    });
    const line = await db.projection.create({
      data: {
        tenantId: 'tenant_acme',
        mappingId: mapping.id,
        period: '2026-02',
        committedQty: 10,
        status: 'Confirmed',
      },
    });
    await db.periodLock.create({
      data: {
        tenantId: 'tenant_acme',
        period: '2026-02',
        lockedById: 'user_admin_acme',
      },
    });

    await expect(
      service.create(admin('tenant_acme', 'acme'), {
        code: 'SO-LOCKED-MONTH',
        customerId: 'cust_1_acme',
        salespersonId: 'user_sales1_acme',
        items: [{ productId: 'prod_a_acme', qty: 1, price: 100 }],
        projectionId: line.id,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(
      await db.salesOrder.findFirst({ where: { code: 'SO-LOCKED-MONTH' } }),
    ).toBeNull();

    await db.periodLock.deleteMany({ where: { period: '2026-02' } });
    await db.projection.delete({ where: { id: line.id } });
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
