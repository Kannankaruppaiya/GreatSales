import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LeadsService } from './leads.service';

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

describe('LeadsService (integration)', () => {
  let prisma: PrismaService;
  let service: LeadsService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    service = new LeadsService(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('returns the seeded Acme lead enriched with products and total value', async () => {
    const res = await service.list(admin('tenant_acme', 'acme'), { limit: 20 });

    expect(res.items).toHaveLength(1);
    const l = res.items[0];
    expect(l.customerName).toBe('Acme Corp Prospect');
    expect(l.stage).toBe('NeedsAnalysis');
    expect(l.salespersonName).toBe('Acme Corp Sales One');
    expect(l.industryName).toBe('Automotive');
    expect(l.products).toHaveLength(1);
    expect(l.products[0].productName).toBe('New Product X');
    expect(l.totalValue).toBe(75000);
  });

  it('isolates tenants — Globex admin never sees Acme leads (RLS)', async () => {
    const res = await service.list(admin('tenant_globex', 'globex'), {
      limit: 20,
    });
    expect(res.items.every((l) => !l.customerName.includes('Acme'))).toBe(true);
    expect(res.items[0]?.customerName).toBe('Globex Inc Prospect');
  });

  it('scopes a salesperson to their own leads only', async () => {
    const owner = await service.list(sales('tenant_acme', 'acme', 1), {
      limit: 20,
    });
    expect(owner.items).toHaveLength(1);
    const other = await service.list(sales('tenant_acme', 'acme', 2), {
      limit: 20,
    });
    expect(other.items).toHaveLength(0);
  });

  it('creates a lead with line items and sums their value', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      customerName: 'Acme Fresh Lead',
      salespersonId: 'user_sales1_acme',
      products: [
        { productName: 'Widget', value: 100 },
        { productName: 'Gadget', value: 200 },
      ],
    });
    expect(created.customerName).toBe('Acme Fresh Lead');
    expect(created.stage).toBe('NewEnquiries'); // DB default
    expect(created.products).toHaveLength(2);
    expect(created.totalValue).toBe(300);
  });

  it('stamps stageUpdatedAt when the stage changes', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const id = list.items.find(
      (l) => l.customerName === 'Acme Corp Prospect',
    )!.id;

    const updated = await service.update(admin('tenant_acme', 'acme'), id, {
      stage: 'ProposalsAndPriceQuote',
    });
    expect(updated.stage).toBe('ProposalsAndPriceQuote');
    expect(updated.stageUpdatedAt).not.toBeNull();
  });

  it('forbids a salesperson from editing another salesperson lead', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const id = list.items.find(
      (l) => l.customerName === 'Acme Corp Prospect',
    )!.id;
    await expect(
      service.update(sales('tenant_acme', 'acme', 2), id, { area: 'West' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('soft-deletes a lead so it drops out of the list', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      customerName: 'Doomed Lead',
      salespersonId: 'user_sales1_acme',
    });
    await service.remove(admin('tenant_acme', 'acme'), created.id);
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    expect(list.items.some((l) => l.id === created.id)).toBe(false);
    await expect(
      service.update(admin('tenant_acme', 'acme'), created.id, { area: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
