import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { execSync } from 'node:child_process';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FollowUpsService } from './followups.service';

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

/** FollowUp has no seed rows — every test builds the data it needs. */
describe('FollowUpsService (integration)', () => {
  let prisma: PrismaService;
  let service: FollowUpsService;

  beforeAll(async () => {
    execSync('pnpm --filter @greatsales/db db:seed', {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    service = new FollowUpsService(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('creates a follow-up and lists it enriched with owner name', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      entityType: 'Lead',
      entityId: 'lead-x',
      dueDate: '2026-09-01',
      salespersonId: 'user_sales1_acme',
      title: 'Call the buyer',
      amount: 5000,
    });
    expect(created.salespersonName).toBe('Acme Corp Sales One');
    expect(created.amount).toBe(5000);
    expect(created.dueDate).toBe('2026-09-01');
    expect(created.done).toBe(false);

    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    expect(list.items.some((f) => f.id === created.id)).toBe(true);
  });

  it('defaults ownership to the caller when no salesperson is given', async () => {
    const created = await service.create(sales('tenant_acme', 'acme', 2), {
      entityType: 'Payment',
      entityId: 'pay-x',
      dueDate: '2026-09-05',
    });
    expect(created.salespersonId).toBe('user_sales2_acme');
  });

  it('forces a salesperson to own the follow-ups they create', async () => {
    const created = await service.create(sales('tenant_acme', 'acme', 1), {
      entityType: 'Lead',
      entityId: 'lead-y',
      dueDate: '2026-09-02',
      salespersonId: 'user_sales2_acme', // ignored for sales-only callers
    });
    expect(created.salespersonId).toBe('user_sales1_acme');
  });

  it('scopes a salesperson to their own follow-ups only', async () => {
    const s1 = await service.list(sales('tenant_acme', 'acme', 1), {
      limit: 50,
    });
    expect(s1.items.every((f) => f.salespersonId === 'user_sales1_acme')).toBe(
      true,
    );
    expect(s1.items.length).toBeGreaterThan(0);
  });

  it('isolates tenants — Globex admin never sees Acme follow-ups (RLS)', async () => {
    const res = await service.list(admin('tenant_globex', 'globex'), {
      limit: 50,
    });
    expect(res.items.every((f) => f.salespersonId.endsWith('_globex'))).toBe(
      true,
    );
  });

  it('marks a follow-up done via update', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      entityType: 'Projection',
      entityId: 'proj-x',
      dueDate: '2026-09-10',
      salespersonId: 'user_sales1_acme',
    });
    const updated = await service.update(
      admin('tenant_acme', 'acme'),
      created.id,
      {
        done: true,
      },
    );
    expect(updated.done).toBe(true);
  });

  it('forbids a salesperson from editing another salesperson follow-up', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      entityType: 'Lead',
      entityId: 'lead-z',
      dueDate: '2026-09-12',
      salespersonId: 'user_sales1_acme',
    });
    await expect(
      service.update(sales('tenant_acme', 'acme', 2), created.id, {
        done: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('hard-deletes a follow-up so it drops out of the list', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      entityType: 'Lead',
      entityId: 'lead-del',
      dueDate: '2026-09-20',
      salespersonId: 'user_sales1_acme',
    });
    await service.remove(admin('tenant_acme', 'acme'), created.id);
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 50,
    });
    expect(list.items.some((f) => f.id === created.id)).toBe(false);
    await expect(
      service.update(admin('tenant_acme', 'acme'), created.id, { done: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
