import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

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
const TODAY = '2026-08-19';

describe('PaymentsService (integration)', () => {
  let prisma: PrismaService;
  let service: PaymentsService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    service = new PaymentsService(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('returns the seeded Acme payment with derived pending + status', async () => {
    const res = await service.list(
      admin('tenant_acme', 'acme'),
      { limit: 20 },
      TODAY,
    );

    expect(res.items).toHaveLength(1);
    const p = res.items[0];
    expect(p.refNo).toBe('PAY-ACME-001');
    expect(p.customerName).toBe('Acme Corp Customer One');
    expect(p.salespersonName).toBe('Acme Corp Sales One');
    expect(p.amount).toBe(100000);
    expect(p.received).toBe(60000);
    expect(p.pending).toBe(40000);
    expect(p.status).toBe('PartiallyPaid');
    expect(p.followups).toHaveLength(1);
  });

  it('isolates tenants — Globex admin never sees Acme payments (RLS)', async () => {
    const res = await service.list(
      admin('tenant_globex', 'globex'),
      { limit: 20 },
      TODAY,
    );
    expect(res.items.every((p) => p.refNo !== 'PAY-ACME-001')).toBe(true);
    expect(res.items[0]?.refNo).toBe('PAY-GLOBEX-001');
  });

  it('scopes a salesperson to their own payments only', async () => {
    const owner = await service.list(
      sales('tenant_acme', 'acme', 1),
      { limit: 20 },
      TODAY,
    );
    expect(owner.items).toHaveLength(1);
    const other = await service.list(
      sales('tenant_acme', 'acme', 2),
      { limit: 20 },
      TODAY,
    );
    expect(other.items).toHaveLength(0);
  });

  it('creates a manual payment with no linked customer', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      amount: 5000,
      customerName: 'Walk-in Buyer',
    });
    expect(created.customerId).toBeNull();
    expect(created.customerName).toBe('Walk-in Buyer');
    expect(created.pending).toBe(5000);
    expect(created.status).toBe('Pending');
  });

  it('derives Overdue for an unpaid, past-due payment', async () => {
    await service.create(admin('tenant_acme', 'acme'), {
      amount: 1000,
      refNo: 'PAY-OVERDUE',
      dueDate: '2026-01-01',
    });
    const res = await service.list(
      admin('tenant_acme', 'acme'),
      { limit: 20 },
      TODAY,
    );
    const p = res.items.find((x) => x.refNo === 'PAY-OVERDUE')!;
    expect(p.status).toBe('Overdue');
    expect(p.agingDays).toBeGreaterThan(0);
  });

  it('recomputes pending + status when a receipt is recorded', async () => {
    const list = await service.list(
      admin('tenant_acme', 'acme'),
      { limit: 20 },
      TODAY,
    );
    const id = list.items.find((p) => p.refNo === 'PAY-ACME-001')!.id;

    const updated = await service.update(admin('tenant_acme', 'acme'), id, {
      received: 100000,
    });
    expect(updated.pending).toBe(0);
    expect(updated.status).toBe('Paid');
  });

  it('forces a salesperson to own the payments they create', async () => {
    const created = await service.create(sales('tenant_acme', 'acme', 1), {
      amount: 200,
      salespersonId: 'user_sales2_acme',
    });
    expect(created.salespersonId).toBe('user_sales1_acme');
  });

  it('forbids a salesperson from editing another salesperson payment', async () => {
    const list = await service.list(
      admin('tenant_acme', 'acme'),
      { limit: 20 },
      TODAY,
    );
    const id = list.items.find((p) => p.refNo === 'PAY-ACME-001')!.id;
    await expect(
      service.update(sales('tenant_acme', 'acme', 2), id, { delayReason: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('soft-deletes a payment so it drops out of the list', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      amount: 10,
      refNo: 'PAY-DOOM',
    });
    await service.remove(admin('tenant_acme', 'acme'), created.id);
    const list = await service.list(
      admin('tenant_acme', 'acme'),
      { limit: 20 },
      TODAY,
    );
    expect(list.items.some((p) => p.id === created.id)).toBe(false);
    await expect(
      service.update(admin('tenant_acme', 'acme'), created.id, { amount: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
