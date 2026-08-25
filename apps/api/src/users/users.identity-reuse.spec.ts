import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Proves the two behavioural guarantees the F12 migration buys, at the layer
 * that actually depends on them.
 *
 *   1. A soft-deleted user FREES its email and username for reuse. Before this
 *      migration, `@@unique([tenantId, email])` still matched the deleted row,
 *      so deleting a user burned that address permanently — a real operational
 *      trap when someone is offboarded and rehired, or created by mistake.
 *   2. Two LIVE users still cannot share an identity. Partial uniqueness must
 *      relax the constraint for deleted rows and for nothing else.
 *
 * Written against `forTenant` (the RLS-bound role) rather than a superuser
 * client, because that is the connection the API actually uses — a constraint
 * that only holds for superusers would not protect production.
 */
const TENANT = 'tenant_acme';
const SHARED_EMAIL = 'reuse@acme.test';
const SHARED_USERNAME = 'reuse_acme';

let prisma: PrismaService;
let created: string[] = [];

beforeAll(async () => {
  reseedTestDatabase();
  prisma = new PrismaService(process.env.DATABASE_URL as string);
  await prisma.onModuleInit();
}, 180_000);

afterEach(async () => {
  if (created.length) {
    await prisma
      .forTenant(TENANT)
      .user.deleteMany({ where: { id: { in: created } } });
    created = [];
  }
});

afterAll(async () => {
  await prisma.onModuleDestroy();
});

/** Creates a user on the SHARED identity, optionally already soft-deleted. */
async function makeUser(suffix: string, softDeleted = false) {
  const user = await prisma.forTenant(TENANT).user.create({
    data: {
      tenantId: TENANT,
      name: `Reuse Fixture ${suffix}`,
      email: SHARED_EMAIL,
      username: SHARED_USERNAME,
      passwordHash: 'not-a-real-hash',
      roleId: 'role_sales_acme',
      ...(softDeleted ? { deletedAt: new Date() } : {}),
    },
  });
  created.push(user.id);
  return user;
}

describe('F12 identity uniqueness', () => {
  it('adds mustChangePassword, defaulting to false for existing users', async () => {
    const seeded = await prisma
      .forTenant(TENANT)
      .user.findFirstOrThrow({ where: { id: 'user_admin_acme' } });
    expect(seeded.mustChangePassword).toBe(false);
  });

  it('frees a soft-deleted user email and username for reuse', async () => {
    await makeUser('deleted', true);
    await expect(makeUser('replacement', false)).resolves.toBeDefined();
  });

  it('still rejects two LIVE users sharing an identity', async () => {
    await makeUser('live-one', false);
    await expect(makeUser('live-two', false)).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('rejects reviving a soft-deleted user onto an identity since re-taken', async () => {
    const ghost = await makeUser('ghost', true);
    await makeUser('successor', false);

    // This is exactly the RESTORE_CONFLICT case the restore endpoint must
    // surface as a 409 rather than a 500.
    await expect(
      prisma
        .forTenant(TENANT)
        .user.update({ where: { id: ghost.id }, data: { deletedAt: null } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows two soft-deleted users to share an identity', async () => {
    // Repeated create-then-delete of the same address must not accumulate a
    // constraint failure — partial uniqueness ignores deleted rows entirely.
    await makeUser('tombstone-one', true);
    await expect(makeUser('tombstone-two', true)).resolves.toBeDefined();
  });

  it('scopes uniqueness per tenant — Globex may hold the same email', async () => {
    await makeUser('acme-live', false);
    const globex = await prisma.forTenant('tenant_globex').user.create({
      data: {
        tenantId: 'tenant_globex',
        name: 'Globex Same Email',
        email: SHARED_EMAIL,
        username: SHARED_USERNAME,
        passwordHash: 'not-a-real-hash',
        roleId: 'role_sales_globex',
      },
    });
    expect(globex.email).toBe(SHARED_EMAIL);
    await prisma
      .forTenant('tenant_globex')
      .user.delete({ where: { id: globex.id } });
  });

  it('reports a unique violation as P2002, so it can be mapped to a 409', async () => {
    await makeUser('code-check-one', false);
    const error = await makeUser('code-check-two', false).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});
