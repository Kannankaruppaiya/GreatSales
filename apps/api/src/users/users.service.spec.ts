import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { execSync } from 'node:child_process';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { verifyPassword } from '../auth/hash';
import { UsersService } from './users.service';

const admin = (tid: string, roleKey: string): RequestUser => ({
  userId: `user_admin_${roleKey}`,
  tenantId: tid,
  roleId: `role_admin_${roleKey}`,
});

describe('UsersService (integration)', () => {
  let prisma: PrismaService;
  let service: UsersService;

  beforeAll(async () => {
    execSync('pnpm --filter @greatsales/db db:seed', {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    service = new UsersService(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('lists tenant users enriched with role/manager/team, never a hash', async () => {
    const res = await service.list(admin('tenant_acme', 'acme'), { limit: 20 });

    expect(res.items).toHaveLength(4);
    const a = res.items.find((u) => u.email === 'admin@acme.test')!;
    expect(a.roleName).toBe('admin');
    expect(a).not.toHaveProperty('passwordHash');

    const s1 = res.items.find((u) => u.username === 'sales1_acme')!;
    expect(s1.managerName).toBe('Acme Corp Manager');
    expect(s1.teamName).toBe('Acme Corp Team');
  });

  it('isolates tenants — Globex admin never sees Acme users (RLS)', async () => {
    const res = await service.list(admin('tenant_globex', 'globex'), {
      limit: 20,
    });
    expect(res.items).toHaveLength(4);
    expect(res.items.every((u) => u.email.endsWith('@globex.test'))).toBe(true);
  });

  it('creates a user and stores a real password hash (not plaintext)', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      name: 'New Rep',
      email: 'newrep@acme.test',
      username: 'newrep_acme',
      password: 'S3cretPassw0rd',
      roleId: 'role_sales_acme',
    });
    expect(created.email).toBe('newrep@acme.test');
    expect(created.roleName).toBe('sales');

    const raw = await prisma
      .forTenant('tenant_acme')
      .user.findUnique({ where: { id: created.id } });
    expect(raw!.passwordHash).not.toBe('S3cretPassw0rd');
    expect(await verifyPassword(raw!.passwordHash, 'S3cretPassw0rd')).toBe(
      true,
    );
  });

  it('rejects a duplicate email within the tenant', async () => {
    await expect(
      service.create(admin('tenant_acme', 'acme'), {
        name: 'Clash',
        email: 'admin@acme.test', // already taken
        username: 'clash_acme',
        password: 'S3cretPassw0rd',
        roleId: 'role_sales_acme',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates scalar fields', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const id = list.items.find((u) => u.username === 'sales2_acme')!.id;

    const updated = await service.update(admin('tenant_acme', 'acme'), id, {
      name: 'Renamed Rep',
      active: false,
    });
    expect(updated.name).toBe('Renamed Rep');
    expect(updated.active).toBe(false);
  });

  it('re-hashes the password on update', async () => {
    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 20,
    });
    const id = list.items.find((u) => u.username === 'sales1_acme')!.id;

    await service.update(admin('tenant_acme', 'acme'), id, {
      password: 'BrandN3wPass',
    });
    const raw = await prisma
      .forTenant('tenant_acme')
      .user.findUnique({ where: { id } });
    expect(await verifyPassword(raw!.passwordHash, 'BrandN3wPass')).toBe(true);
    expect(await verifyPassword(raw!.passwordHash, 'Passw0rd!')).toBe(false);
  });

  it('soft-deletes a user so it drops out of the list', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      name: 'Doomed User',
      email: 'doomed@acme.test',
      username: 'doomed_acme',
      password: 'S3cretPassw0rd',
      roleId: 'role_sales_acme',
    });
    await service.remove(admin('tenant_acme', 'acme'), created.id);

    const list = await service.list(admin('tenant_acme', 'acme'), {
      limit: 50,
    });
    expect(list.items.some((u) => u.id === created.id)).toBe(false);
    await expect(
      service.update(admin('tenant_acme', 'acme'), created.id, { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
