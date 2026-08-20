import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { execSync } from 'node:child_process';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

const admin = (tid: string, roleKey: string): RequestUser => ({
  userId: `user_admin_${roleKey}`,
  tenantId: tid,
  roleId: `role_admin_${roleKey}`,
});

describe('ProductsService (integration)', () => {
  let prisma: PrismaService;
  let service: ProductsService;

  beforeAll(async () => {
    execSync('pnpm --filter @greatsales/db db:seed', {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    service = new ProductsService(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('lists the seeded Acme products enriched with the principal name', async () => {
    const res = await service.list(admin('tenant_acme', 'acme'), { limit: 20 });

    expect(res.items).toHaveLength(2);
    const a = res.items.find((p) => p.name === 'Product A')!;
    expect(a.basePrice).toBe(100);
    expect(a.unit).toBe('kg');
    expect(a.principalName).toBe('Acme Corp Principal Co');
  });

  it('isolates tenants — Globex admin sees only Globex catalog (RLS)', async () => {
    const res = await service.list(admin('tenant_globex', 'globex'), {
      limit: 20,
    });
    expect(res.items).toHaveLength(2);
    expect(
      res.items.every((p) => p.principalName === 'Globex Inc Principal Co'),
    ).toBe(true);
  });

  it('creates a product with a base price', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      name: 'Product C',
      principalId: 'prin_acme',
      sku: 'SKU-C',
      unit: 'box',
      basePrice: 999.5,
    });
    expect(created.name).toBe('Product C');
    expect(created.basePrice).toBe(999.5);
    expect(created.principalName).toBe('Acme Corp Principal Co');
  });

  it('rejects a duplicate SKU within the tenant', async () => {
    await service.create(admin('tenant_acme', 'acme'), {
      name: 'Dup One',
      principalId: 'prin_acme',
      sku: 'SKU-DUP',
    });
    await expect(
      service.create(admin('tenant_acme', 'acme'), {
        name: 'Dup Two',
        principalId: 'prin_acme',
        sku: 'SKU-DUP',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates a product', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const id = list.items.find((p) => p.name === 'Product B')!.id;

    const updated = await service.update(admin('tenant_acme', 'acme'), id, {
      basePrice: 300,
      active: false,
    });
    expect(updated.basePrice).toBe(300);
    expect(updated.active).toBe(false);
  });

  it('soft-deletes a product so it drops out of the list', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      name: 'Doomed Product',
      principalId: 'prin_acme',
    });
    await service.remove(admin('tenant_acme', 'acme'), created.id);
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 50,
    });
    expect(list.items.some((p) => p.id === created.id)).toBe(false);
    await expect(
      service.update(admin('tenant_acme', 'acme'), created.id, {
        active: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
