import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { PERMISSIONS, ROLE_PERMISSIONS } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The permission catalogue in the DATABASE must match the one in the code.
 *
 * This is not theoretical. `PERMISSIONS` lived in three places — shared/rbac.ts
 * and a copy-paste in each of the two seeds — so adding `period.manage` to the
 * shared list left the database without it. The guard then denied a route
 * against a key no role had been granted, and every attempt to lock a period
 * returned 403 while the code plainly said admin held the permission. Nothing
 * failed loudly; the feature was simply dead.
 *
 * The seeds now import the shared list, and this asserts that they did — a
 * fourth copy, or a seed that stops running, fails here instead of shipping as
 * a route nobody can call.
 */
describe('RBAC catalogue', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('seeds exactly the permission keys the code defines', async () => {
    const rows = await prisma.permission.findMany({ select: { key: true } });
    expect(rows.map((r) => r.key).sort()).toEqual(
      PERMISSIONS.map((p) => p.key).sort(),
    );
  });

  it('grants each system role exactly what ROLE_PERMISSIONS says', async () => {
    const db = prisma.forTenant('tenant_acme');
    for (const [slug, expected] of Object.entries(ROLE_PERMISSIONS)) {
      const role = await db.role.findFirst({ where: { name: slug } });
      expect(role).not.toBeNull();

      const granted = await db.rolePermission.findMany({
        where: { roleId: role!.id },
        include: { permission: { select: { key: true } } },
      });
      expect(granted.map((g) => g.permission.key).sort()).toEqual(
        [...expected].sort(),
      );
    }
  });

  it('gives management the period lock, and sales not', () => {
    // The grant that the drift above silently dropped. Asserted by name so a
    // future edit to ROLE_PERMISSIONS has to be deliberate about closing the
    // books, which is a governance decision rather than a list tweak.
    expect(ROLE_PERMISSIONS.mgmt).toContain('period.manage');
    expect(ROLE_PERMISSIONS.sales).not.toContain('period.manage');
    expect(ROLE_PERMISSIONS.admin).toContain('period.manage');
  });
});
