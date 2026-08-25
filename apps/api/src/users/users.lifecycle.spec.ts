import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { DEFAULT_USER_LIST_QUERY, type RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import { makeAuthService } from './test-auth-factory';
import { verifyPassword } from '../auth/hash';

/**
 * Fetching one user, and the delete → restore round trip.
 *
 * The round trip is the reason the F12 migration replaced two unique
 * constraints with partial unique indexes. Deleting a user now FREES their
 * email and username, which is what an operator expects when someone is
 * offboarded or created by mistake — and which means a later restore can
 * legitimately fail because the identity now belongs to someone else. That
 * failure has to be a clear 409, not a 500.
 */
const OK_PW = 'towel-forty-two-vogon';
const ACME: RequestUser = {
  userId: 'user_admin_acme',
  tenantId: 'tenant_acme',
  roleId: 'role_admin_acme',
};
const LIST = { ...DEFAULT_USER_LIST_QUERY, limit: 100 };

let prisma: PrismaService;
let service: UsersService;

beforeAll(async () => {
  prisma = new PrismaService(process.env.DATABASE_URL as string);
  await prisma.onModuleInit();
  service = new UsersService(prisma, makeAuthService(prisma));
}, 120_000);

beforeEach(() => {
  reseedTestDatabase();
}, 120_000);

afterAll(async () => {
  await prisma.onModuleDestroy();
});

const make = (suffix: string) =>
  service.create(ACME, {
    name: `Lifecycle ${suffix}`,
    email: `lifecycle${suffix}@acme.test`,
    username: `lifecycle${suffix}`,
    password: OK_PW,
    roleId: 'role_sales_acme',
  });

describe('get', () => {
  it('returns one user by id', async () => {
    const user = await service.get(ACME, 'user_sales1_acme', false);
    expect(user.email).toBe('sales1@acme.test');
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('404s a user in ANOTHER tenant, revealing nothing about its existence', async () => {
    await expect(
      service.get(ACME, 'user_sales1_globex', false),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'USER_NOT_FOUND' },
    });
  });

  it('404s an id that does not exist at all', async () => {
    await expect(service.get(ACME, 'nope', false)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('404s a soft-deleted user unless includeDeleted is asked for', async () => {
    const user = await make('gone');
    await service.remove(ACME, user.id);

    await expect(service.get(ACME, user.id, false)).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.get(ACME, user.id, true)).resolves.toMatchObject({
      id: user.id,
    });
  });
});

describe('restore', () => {
  it('brings a soft-deleted user back into the default list', async () => {
    const user = await make('back');
    await service.remove(ACME, user.id);

    const restored = await service.restore(ACME, user.id);
    expect(restored.deletedAt).toBeNull();

    const list = await service.list(ACME, LIST);
    expect(list.items.some((u) => u.id === user.id)).toBe(true);
  });

  it('404s a user who is not deleted', async () => {
    await expect(
      service.restore(ACME, 'user_sales1_acme'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('refuses to restore onto an identity that has since been re-taken', async () => {
    const first = await make('taken');
    await service.remove(ACME, first.id);

    // The freed identity is claimed by someone else — exactly what freeing it
    // was for. Restoring the original must now fail, clearly.
    await service.create(ACME, {
      name: 'Successor',
      email: 'lifecycletaken@acme.test',
      username: 'lifecycletaken',
      password: OK_PW,
      roleId: 'role_sales_acme',
    });

    await expect(service.restore(ACME, first.id)).rejects.toMatchObject({
      status: 409,
      response: { code: 'RESTORE_CONFLICT' },
    });
  });

  it('leaves the deleted user untouched when a restore is refused', async () => {
    const first = await make('untouched');
    await service.remove(ACME, first.id);
    await service.create(ACME, {
      name: 'Successor Two',
      email: 'lifecycleuntouched@acme.test',
      username: 'lifecycleuntouched',
      password: OK_PW,
      roleId: 'role_sales_acme',
    });

    await service.restore(ACME, first.id).catch(() => undefined);
    const still = await service.get(ACME, first.id, true);
    expect(still.deletedAt).not.toBeNull();
  });
});

describe('admin password reset', () => {
  it('sets the password, forces a change, and echoes nothing back', async () => {
    const result = await service.resetPassword(ACME, 'user_sales1_acme', {
      password: OK_PW,
    });
    expect(result).toEqual({ mustChangePassword: true });
    expect(JSON.stringify(result)).not.toContain(OK_PW);

    const raw = await prisma
      .forTenant('tenant_acme')
      .user.findUniqueOrThrow({ where: { id: 'user_sales1_acme' } });
    expect(raw.mustChangePassword).toBe(true);
    expect(await verifyPassword(raw.passwordHash, OK_PW)).toBe(true);
  });

  it('applies the shared password policy', async () => {
    await expect(
      service.resetPassword(ACME, 'user_sales1_acme', { password: 'qwerty' }),
    ).rejects.toMatchObject({ response: { code: 'WEAK_PASSWORD' } });
  });

  it('refuses to reset your OWN password through the admin route', async () => {
    // Self-service belongs on /auth/change-password, which demands the current
    // password. Allowing it here would turn a stolen access token into
    // permanent account takeover.
    await expect(
      service.resetPassword(ACME, 'user_admin_acme', { password: OK_PW }),
    ).rejects.toMatchObject({ response: { code: 'SELF_MUTATION_FORBIDDEN' } });
  });

  it('404s a soft-deleted user', async () => {
    const user = await make('resetgone');
    await service.remove(ACME, user.id);
    await expect(
      service.resetPassword(ACME, user.id, { password: OK_PW }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('404s a user in another tenant', async () => {
    await expect(
      service.resetPassword(ACME, 'user_sales1_globex', { password: OK_PW }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
