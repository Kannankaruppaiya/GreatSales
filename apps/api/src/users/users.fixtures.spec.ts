import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Guards the shape of the seed fixture that the F12 suites depend on.
 *
 * These are not incidental conveniences. Each one exists because a real
 * invariant CANNOT be tested without it:
 *
 *   - A second admin, or the last-admin guard can never be exercised from a
 *     realistic starting state (the first removal would always be the last).
 *   - A role with zero users, or the "role dropdown must not be derived from
 *     loaded rows" defect cannot be proven fixed.
 *   - A second team, so "move a member between teams" is testable.
 *   - Enough users that a small page is genuinely partial, so cursor paging is
 *     exercised rather than assumed.
 *
 * If this file fails, the seed drifted and the suites that follow are no longer
 * testing what they claim to.
 */
let prisma: PrismaService;

beforeAll(async () => {
  reseedTestDatabase();
  prisma = new PrismaService(process.env.DATABASE_URL as string);
  await prisma.onModuleInit();
}, 180_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
});

describe.each(['acme', 'globex'])('seed fixture for tenant_%s', (k) => {
  const tenant = `tenant_${k}`;

  it('seeds at least two live admins, so last-admin guards are testable', async () => {
    const admins = await prisma.forTenant(tenant).user.findMany({
      where: { roleId: `role_admin_${k}`, deletedAt: null, active: true },
    });
    expect(admins.length).toBeGreaterThanOrEqual(2);
  });

  it('seeds a custom, non-system role that has NO users', async () => {
    const db = prisma.forTenant(tenant);
    const role = await db.role.findUniqueOrThrow({
      where: { id: `role_viewer_${k}` },
    });
    expect(role.isSystem).toBe(false);
    expect(await db.user.count({ where: { roleId: role.id } })).toBe(0);
  });

  it('grants the custom role a real, narrower permission set', async () => {
    const grants = await prisma.forTenant(tenant).rolePermission.findMany({
      where: { roleId: `role_viewer_${k}` },
      include: { permission: true },
    });
    const keys = grants.map((g) => g.permission.key).sort();
    expect(keys).toEqual(['customer.read', 'report.view']);
  });

  it('seeds a second team, so members can be moved between teams', async () => {
    await expect(
      prisma
        .forTenant(tenant)
        .team.findUniqueOrThrow({ where: { id: `team_secondary_${k}` } }),
    ).resolves.toBeDefined();
  });

  it('seeds enough users that a small page is genuinely partial', async () => {
    const count = await prisma
      .forTenant(tenant)
      .user.count({ where: { deletedAt: null } });
    expect(count).toBeGreaterThanOrEqual(16);
  });

  it('seeds both active and inactive users, so the status filter has both sides', async () => {
    const db = prisma.forTenant(tenant);
    expect(
      await db.user.count({ where: { active: true, deletedAt: null } }),
    ).toBeGreaterThan(0);
    expect(
      await db.user.count({ where: { active: false, deletedAt: null } }),
    ).toBeGreaterThan(0);
  });

  it('keeps every seeded user inside its own tenant', async () => {
    const strays = await prisma
      .forTenant(tenant)
      .user.count({ where: { tenantId: { not: tenant } } });
    expect(strays).toBe(0);
  });
});
