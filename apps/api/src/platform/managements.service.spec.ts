import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { JwtAccessClaims } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ManagementsService } from './managements.service';
import { PlatformPrismaService } from './platform-prisma.service';
import type { PlatformPrincipal } from './platform.decorators';
import { disconnectOwnerDb, setTenantStatus } from '../test-support/owner-db';

/**
 * The F14 token-exchange, proven against real Postgres. Assuming a management
 * must (a) only ever borrow that tenant's OWN admin — never another tenant's,
 * which is the RLS guarantee — (b) mint a usable tenant access token, and
 * (c) leave an audit row. It must refuse an unknown or suspended tenant.
 */
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;

const owner: PlatformPrincipal = {
  id: 'pu_super',
  role: 'SuperAdmin',
  name: 'Platform Super Admin',
  email: 'super@greatsales.io',
};

describe('ManagementsService (assume / token-exchange)', () => {
  let prisma: PrismaService;
  let platformDb: PlatformPrismaService;
  let jwt: JwtService;
  let svc: ManagementsService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    platformDb = new PlatformPrismaService(process.env.DIRECT_URL as string);
    await platformDb.onModuleInit();
    jwt = new JwtService({});
    const auth = new AuthService(
      prisma,
      jwt,
      new ConfigService({
        JWT_ACCESS_SECRET: ACCESS_SECRET,
        JWT_REFRESH_SECRET: REFRESH_SECRET,
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL: '7d',
        NODE_ENV: 'test',
      }),
    );
    svc = new ManagementsService(prisma, platformDb, auth);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await platformDb.onModuleDestroy();
    await disconnectOwnerDb();
  });

  it('mints a working tenant session for that management’s own admin', async () => {
    const res = await svc.assume(owner, 'tenant_acme');

    expect(res.user.tenantId).toBe('tenant_acme');
    expect(res.user.email).toBe('admin@acme.test');
    expect(res.user.role).toBe('admin');
    expect(res.accessToken).toBeTruthy();
    expect(res.refreshTokenValue).toBeTruthy();

    // The minted access token is a genuine tenant token, scoped to tenant_acme.
    const claims = jwt.verify<JwtAccessClaims>(res.accessToken, {
      secret: ACCESS_SECRET,
    });
    expect(claims.typ).toBe('access');
    expect(claims.tid).toBe('tenant_acme');
    expect(claims.sub).toBe('user_admin_acme');
  });

  it('borrows the CORRECT tenant’s admin — never another tenant’s (RLS)', async () => {
    const acme = await svc.assume(owner, 'tenant_acme');
    const globex = await svc.assume(owner, 'tenant_globex');

    expect(acme.user.email).toBe('admin@acme.test');
    expect(globex.user.email).toBe('admin@globex.test');
    expect(globex.user.tenantId).toBe('tenant_globex');
  });

  it('writes a PlatformAuditLog row naming who assumed which tenant', async () => {
    const before = await platformDb.platformAuditLog.count({
      where: { action: 'tenant.impersonate', tenantId: 'tenant_acme' },
    });
    await svc.assume(owner, 'tenant_acme');
    const rows = await platformDb.platformAuditLog.findMany({
      where: { action: 'tenant.impersonate', tenantId: 'tenant_acme' },
      orderBy: { at: 'desc' },
      take: 1,
    });

    expect(
      await platformDb.platformAuditLog.count({
        where: { action: 'tenant.impersonate', tenantId: 'tenant_acme' },
      }),
    ).toBe(before + 1);
    expect(rows[0].platformUserId).toBe('pu_super');
    expect(rows[0].targetId).toBe('tenant_acme');
  });

  it('refuses an unknown management', async () => {
    await expect(
      svc.assume(owner, 'tenant_does_not_exist'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a suspended management', async () => {
    await setTenantStatus('tenant_globex', 'Suspended');
    try {
      await expect(svc.assume(owner, 'tenant_globex')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    } finally {
      await setTenantStatus('tenant_globex', 'Active');
    }
  });

  it('lists every management with headline stats (cross-tenant, owner role)', async () => {
    const list = await svc.list();
    const byId = new Map(list.map((m) => [m.id, m]));

    expect(byId.has('tenant_acme')).toBe(true);
    expect(byId.has('tenant_globex')).toBe(true);
    // Acme is seeded with several active users; the count must be real, not 0.
    expect(byId.get('tenant_acme')!.userCount).toBeGreaterThan(0);
    expect(typeof byId.get('tenant_acme')!.salesThisMonth).toBe('number');
  });

  it('provisions a working management: it appears in the list and can be opened', async () => {
    const res = await svc.create(owner, {
      name: 'Nova Foods',
      industry: 'Food & Beverage',
      region: 'in',
      currency: 'INR (₹)',
      adminName: 'Nova Admin',
      adminEmail: 'admin@nova.test',
    });

    expect(res.management.name).toBe('Nova Foods');
    expect(res.management.status).toBe('Trial');
    expect(res.management.currency).toBe('INR (₹)');
    expect(res.management.userCount).toBe(1);
    expect(res.tempPassword).toBeTruthy();

    const newId = res.management.id;

    // It shows up on the owner's grid.
    const list = await svc.list();
    expect(list.some((m) => m.id === newId)).toBe(true);

    // And provisioning wired the admin + system roles correctly: the owner can
    // open it, landing as that new tenant's own admin (proves the role graph
    // and RLS scope for a brand-new tenant).
    const opened = await svc.assume(owner, newId);
    expect(opened.user.tenantId).toBe(newId);
    expect(opened.user.email).toBe('admin@nova.test');
    expect(opened.user.role).toBe('admin');
    expect(opened.user.mustChangePassword).toBe(true);
  });
});
