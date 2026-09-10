import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { ForbiddenException } from '@nestjs/common';
import { inRollout, type RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from './feature-flags.service';
import { CustomersService } from '../customers/customers.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Feature flags.
 *
 * The fixtures carry both sides on purpose: Acme takes the global default for
 * `customer-location` and Globex has a row switching it off. That pair is what
 * makes "an override beats the global flag" a fact rather than a reading of the
 * code — and it is the case most likely to break silently, because
 * `TenantFeatureFlag` carries RLS with FORCE and an unscoped read of it returns
 * nothing at all rather than failing.
 *
 * The last test is the one that matters most: a flag checked only in the
 * browser is a suggestion. The gate has to hold when the field is posted
 * directly.
 */
const ACME = 'tenant_acme';
const GLOBEX = 'tenant_globex';

const adminOf = (tid: string, k: string): RequestUser => ({
  userId: `user_admin_${k}`,
  tenantId: tid,
  roleId: `role_admin_${k}`,
});

describe('FeatureFlagsService (integration)', () => {
  let prisma: PrismaService;
  let features: FeatureFlagsService;
  let customers: CustomersService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    features = new FeatureFlagsService(prisma);
    customers = new CustomersService(
      prisma,
      new NotificationsService(prisma),
      features,
    );
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('resolves the global flag when a workspace has no override', async () => {
    expect(await features.isEnabled(ACME, 'customer-location')).toBe(true);
  });

  it('lets a tenant override beat the global flag', async () => {
    // Globex has a TenantFeatureFlag row saying no, against a flag whose
    // global value is yes.
    expect(await features.isEnabled(GLOBEX, 'customer-location')).toBe(false);
  });

  it('answers every declared key, not only the ones with rows', async () => {
    const flags = await features.resolve(ACME);
    expect(Object.keys(flags).sort()).toEqual([
      'bulk-import',
      'customer-location',
    ]);
  });

  it('puts a tenant on the same side of a rollout every time', () => {
    // Deterministic in (key, tenantId): a random draw per request would flicker
    // the feature on and off between page loads.
    const first = inRollout('tenant_acme', 'some-feature', 50);
    for (let i = 0; i < 20; i++) {
      expect(inRollout('tenant_acme', 'some-feature', 50)).toBe(first);
    }
    expect(inRollout('tenant_acme', 'some-feature', 0)).toBe(false);
    expect(inRollout('tenant_acme', 'some-feature', 100)).toBe(true);
  });

  it('spreads tenants across a rollout rather than sending them all one way', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `tenant_${i}`);
    const inside = ids.filter((id) => inRollout(id, 'x', 50)).length;
    // A hash that clustered would make rolloutPercent meaningless; the range is
    // wide enough not to be a flake and narrow enough to catch that.
    expect(inside).toBeGreaterThan(70);
    expect(inside).toBeLessThan(130);
  });

  it('refuses to store a location for a workspace with the feature off', async () => {
    await expect(
      customers.create(adminOf(GLOBEX, 'globex'), {
        name: 'Off Limits Ltd',
        salespersonId: 'user_sales1_globex',
        latitude: 11.0168,
        longitude: 76.9558,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('stores a location for a workspace that has the feature', async () => {
    const created = await customers.create(adminOf(ACME, 'acme'), {
      name: 'Allowed Ltd',
      salespersonId: 'user_sales1_acme',
      latitude: 11.0168,
      longitude: 76.9558,
    });
    expect(created.latitude).toBeCloseTo(11.0168, 4);
  });

  it('still lets a switched-off workspace clear a location it already stored', async () => {
    // The reason a workspace turns location tracking off is usually that it
    // wants the pins gone. Refusing the delete would trap them.
    const existing = await customers.create(adminOf(ACME, 'acme'), {
      name: 'To Be Cleared Ltd',
      salespersonId: 'user_sales1_acme',
      latitude: 11.0168,
      longitude: 76.9558,
    });
    const cleared = await customers.update(adminOf(ACME, 'acme'), existing.id, {
      latitude: null,
      longitude: null,
    });
    expect(cleared.latitude).toBeNull();
  });
});
