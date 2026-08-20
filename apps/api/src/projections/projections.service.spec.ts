import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { execSync } from 'node:child_process';
import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionsService } from './projections.service';

/**
 * Integration test against the real Dockerized Postgres via the RLS-bound app
 * role. Reseeds once for determinism, then exercises the service end-to-end:
 * enrichment + computed values, RLS tenant isolation, and role scoping.
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

describe('ProjectionsService (integration)', () => {
  let prisma: PrismaService;
  let service: ProjectionsService;

  beforeAll(async () => {
    execSync('pnpm --filter @greatsales/db db:seed', {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    service = new ProjectionsService(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('returns the seeded Acme line enriched with computed values', async () => {
    const res = await service.list(admin('tenant_acme', 'acme'), {
      period: '2026-08',
      lineFilter: 'all',
    });

    expect(res.summary.totLines).toBe(1);
    const line = res.lines[0];
    expect(line.customerName).toBe('Acme Corp Customer One');
    expect(line.productName).toBe('Product A');
    expect(line.principalName).toBe('Acme Corp Principal Co');
    expect(line.salespersonName).toBe('Acme Corp Sales One');
    expect(line.price).toBe(100);
    expect(line.committedQty).toBe(1000);
    expect(line.achievedQty).toBe(600);
    expect(line.projValue).toBe(100_000);
    expect(line.achValue).toBe(60_000);
    expect(line.achPct).toBe(60);
    expect(line.status).toBe('PartiallyConfirmed');
    expect(res.summary).toEqual({
      totLines: 1,
      totCommitted: 100_000,
      totAchieved: 60_000,
      totPct: 60,
    });
  });

  it('isolates tenants — Globex admin never sees Acme rows (RLS)', async () => {
    const res = await service.list(admin('tenant_globex', 'globex'), {
      period: '2026-08',
      lineFilter: 'all',
    });
    expect(res.lines.every((l) => !l.customerName.includes('Acme'))).toBe(true);
    expect(res.lines[0]?.customerName).toBe('Globex Inc Customer One');
  });

  it('scopes a salesperson to their own lines only', async () => {
    const owner = await service.list(sales('tenant_acme', 'acme', 1), {
      period: '2026-08',
      lineFilter: 'all',
    });
    expect(owner.summary.totLines).toBe(1);

    const other = await service.list(sales('tenant_acme', 'acme', 2), {
      period: '2026-08',
      lineFilter: 'all',
    });
    expect(other.summary.totLines).toBe(0);
  });

  it('recomputes achievement when a cell is patched', async () => {
    const before = await service.list(admin('tenant_acme', 'acme'), {
      period: '2026-08',
      lineFilter: 'all',
    });
    const id = before.lines[0].id;

    const updated = await service.update(admin('tenant_acme', 'acme'), id, {
      achievedQty: 1000,
    });
    expect(updated.achievedQty).toBe(1000);
    expect(updated.achValue).toBe(100_000);
    expect(updated.achPct).toBe(100);
  });

  it('forbids a salesperson from editing another salesperson line', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      period: '2026-08',
      lineFilter: 'all',
    });
    const id = list.lines[0].id;

    await expect(
      service.update(sales('tenant_acme', 'acme', 2), id, { achievedQty: 5 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
