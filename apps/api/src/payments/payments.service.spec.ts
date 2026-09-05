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

  describe('import (bulk)', () => {
    it('creates new rows, skips duplicates, and reports per row', async () => {
      const res = await service.import(admin('tenant_acme', 'acme'), {
        rows: [
          { rowNumber: 1, refNo: 'IMP-A', amount: 1000, received: 400 },
          // Repeated later in the same sheet — first wins, this one skips.
          { rowNumber: 2, refNo: 'IMP-A', amount: 9999 },
          // Already live in the ledger (created by an earlier test) — skips.
          { rowNumber: 3, refNo: 'PAY-ACME-001', amount: 5 },
          { rowNumber: 4, refNo: 'IMP-B', amount: 2000 },
          // No reference — always inserts, never a duplicate.
          { rowNumber: 5, customerName: 'Walk-in', amount: 300 },
        ],
      });

      expect(res.created).toBe(3);
      expect(res.skippedDuplicates).toBe(2);
      expect(res.failed).toBe(0);
      expect(res.totalRows).toBe(5);
      expect(res.importJobId).toBeTruthy();

      const byRow = new Map(res.results.map((r) => [r.rowNumber, r]));
      expect(byRow.get(1)!.status).toBe('created');
      expect(byRow.get(2)!.status).toBe('skipped_duplicate');
      expect(byRow.get(3)!.status).toBe('skipped_duplicate');
      expect(byRow.get(4)!.status).toBe('created');
      expect(byRow.get(5)!.status).toBe('created');

      // The created row's money was derived server-side, not trusted.
      const list = await service.list(
        admin('tenant_acme', 'acme'),
        { limit: 100 },
        TODAY,
      );
      const impA = list.items.find((p) => p.refNo === 'IMP-A')!;
      expect(impA.amount).toBe(1000);
      expect(impA.pending).toBe(600);
      expect(impA.status).toBe('PartiallyPaid');
    });

    it('re-importing the same sheet double-counts nothing (skips everything)', async () => {
      const rows = [
        { rowNumber: 1, refNo: 'IMP-RERUN-1', amount: 111 },
        { rowNumber: 2, refNo: 'IMP-RERUN-2', amount: 222 },
      ];
      const first = await service.import(admin('tenant_acme', 'acme'), {
        rows,
      });
      expect(first.created).toBe(2);

      const second = await service.import(admin('tenant_acme', 'acme'), {
        rows,
      });
      expect(second.created).toBe(0);
      expect(second.skippedDuplicates).toBe(2);

      const list = await service.list(
        admin('tenant_acme', 'acme'),
        { limit: 100 },
        TODAY,
      );
      expect(list.items.filter((p) => p.refNo === 'IMP-RERUN-1')).toHaveLength(
        1,
      );
    });

    it('records an ImportJob for the attempt', async () => {
      const before = await prisma
        .forTenant('tenant_acme')
        .importJob.count({ where: { type: 'payments' } });
      await service.import(admin('tenant_acme', 'acme'), {
        rows: [{ rowNumber: 1, refNo: 'IMP-JOB-1', amount: 10 }],
      });
      const after = await prisma
        .forTenant('tenant_acme')
        .importJob.count({ where: { type: 'payments' } });
      expect(after).toBe(before + 1);
    });

    it('lets a soft-deleted reference be re-imported (partial-unique on live rows)', async () => {
      const created = await service.import(admin('tenant_acme', 'acme'), {
        rows: [{ rowNumber: 1, refNo: 'IMP-REUSE', amount: 50 }],
      });
      const id = created.results[0].paymentId!;
      await service.remove(admin('tenant_acme', 'acme'), id);

      const again = await service.import(admin('tenant_acme', 'acme'), {
        rows: [{ rowNumber: 1, refNo: 'IMP-REUSE', amount: 70 }],
      });
      expect(again.created).toBe(1);
      expect(again.skippedDuplicates).toBe(0);
    });

    it('the DB backstop rejects a second live row with the same (tenant, refNo)', async () => {
      await service.create(admin('tenant_acme', 'acme'), {
        amount: 10,
        refNo: 'IMP-BACKSTOP',
      });
      // Bypass the service dedupe and insert straight through the tenant client:
      // the partial-unique index must still refuse the duplicate.
      await expect(
        prisma.forTenant('tenant_acme').payment.create({
          data: {
            tenant: { connect: { id: 'tenant_acme' } },
            amount: 10,
            refNo: 'IMP-BACKSTOP',
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('isolates tenants — an Acme reference does not collide with Globex', async () => {
      await service.import(admin('tenant_acme', 'acme'), {
        rows: [{ rowNumber: 1, refNo: 'IMP-SHARED', amount: 1 }],
      });
      const globex = await service.import(admin('tenant_globex', 'globex'), {
        rows: [{ rowNumber: 1, refNo: 'IMP-SHARED', amount: 1 }],
      });
      expect(globex.created).toBe(1);
      expect(globex.skippedDuplicates).toBe(0);
    });
  });
});
