import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { verifyPassword } from './hash';

/**
 * Self-service password change.
 *
 * F1 deferred this deliberately, leaving "an admin must reset a user
 * directly" as the only recovery path. F12 forces the issue: an admin reset
 * that demands a change on next sign-in is a trap unless the user has a way
 * to perform one.
 *
 * The security properties under test are: the CURRENT password is required
 * (an access token alone must never be enough to take an account over), the
 * shared strength policy applies, and every OTHER session dies while the
 * caller's own survives.
 */
const ACME = 'tenant_acme';
const PASSWORD = 'Passw0rd!';
const ADMIN_EMAIL = 'admin@acme.test';
const NEW_PASSWORD = 'towel-forty-two-vogon';

const PRINCIPAL: RequestUser = {
  userId: 'user_admin_acme',
  tenantId: ACME,
  roleId: 'role_admin_acme',
};

/** Reads `fid` out of a refresh JWT without verifying — test-only. */
function familyOf(token: string): string {
  const payload: unknown = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString(),
  );
  return (payload as { fid: string }).fid;
}

describe('AuthService.changePassword', () => {
  let prisma: PrismaService;
  let auth: AuthService;

  const signIn = (email = ADMIN_EMAIL, password = PASSWORD) =>
    auth.login({
      tenantId: ACME,
      email,
      password,
      tokenDelivery: 'cookie' as const, client: 'web' as const
    });

  beforeAll(async () => {
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    auth = new AuthService(
      prisma,
      new JwtService({}),
      new ConfigService({
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL: '7d',
        NODE_ENV: 'test',
      }),
    );
  }, 120_000);

  // Each test mutates the admin's credential, so the fixture is rebuilt every
  // time rather than leaving later tests to guess the current password.
  beforeEach(() => {
    reseedTestDatabase();
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('rejects a wrong current password and changes nothing', async () => {
    await expect(
      auth.changePassword(
        PRINCIPAL,
        { currentPassword: 'not-the-password', newPassword: NEW_PASSWORD },
        null,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const user = await prisma
      .forTenant(ACME)
      .user.findUniqueOrThrow({ where: { id: PRINCIPAL.userId } });
    expect(await verifyPassword(user.passwordHash, PASSWORD)).toBe(true);
  });

  it('answers a wrong current password without naming the field', async () => {
    // The same indistinguishable message the sign-in path uses, so a probe
    // cannot tell "wrong password" from "no such account" from "inactive".
    const error: unknown = await auth
      .changePassword(
        PRINCIPAL,
        { currentPassword: 'nope', newPassword: NEW_PASSWORD },
        null,
      )
      .catch((e: unknown) => e);
    expect((error as Error).message).toBe('Invalid credentials');
  });

  it('rejects a new password that is too short', async () => {
    await expect(
      auth.changePassword(
        PRINCIPAL,
        { currentPassword: PASSWORD, newPassword: 'short' },
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a new password containing the user own username', async () => {
    await expect(
      auth.changePassword(
        PRINCIPAL,
        { currentPassword: PASSWORD, newPassword: 'xx-admin_acme-xxxx' },
        null,
      ),
    ).rejects.toMatchObject({ response: { code: 'WEAK_PASSWORD' } });
  });

  it('stores a real argon2 hash and invalidates the old password', async () => {
    await auth.changePassword(
      PRINCIPAL,
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      null,
    );

    const user = await prisma
      .forTenant(ACME)
      .user.findUniqueOrThrow({ where: { id: PRINCIPAL.userId } });
    expect(user.passwordHash).not.toBe(NEW_PASSWORD);
    expect(await verifyPassword(user.passwordHash, NEW_PASSWORD)).toBe(true);
    expect(await verifyPassword(user.passwordHash, PASSWORD)).toBe(false);
  });

  it('clears mustChangePassword, releasing the gate', async () => {
    const db = prisma.forTenant(ACME);
    await db.user.update({
      where: { id: PRINCIPAL.userId },
      data: { mustChangePassword: true },
    });

    await auth.changePassword(
      PRINCIPAL,
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      null,
    );

    const user = await db.user.findUniqueOrThrow({
      where: { id: PRINCIPAL.userId },
    });
    expect(user.mustChangePassword).toBe(false);
  });

  it('revokes OTHER sessions but keeps the calling session alive', async () => {
    const other = await signIn();
    const mine = await signIn();

    await auth.changePassword(
      PRINCIPAL,
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      familyOf(mine.refreshTokenValue),
    );

    await expect(auth.refresh(other.refreshTokenValue)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(auth.refresh(mine.refreshTokenValue)).resolves.toBeDefined();
  });

  it('revokes EVERY session when no calling family is identified', async () => {
    // A native client with no cookie cannot name its own family; the safe
    // reading is "revoke everything" rather than "revoke nothing".
    const session = await signIn();

    await auth.changePassword(
      PRINCIPAL,
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      null,
    );

    await expect(
      auth.refresh(session.refreshTokenValue),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('leaves another user sessions untouched', async () => {
    const others = await signIn('sales1@acme.test');

    await auth.changePassword(
      PRINCIPAL,
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      null,
    );

    await expect(auth.refresh(others.refreshTokenValue)).resolves.toBeDefined();
  });

  it('lets the user sign in with the new password afterwards', async () => {
    await auth.changePassword(
      PRINCIPAL,
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      null,
    );
    await expect(signIn(ADMIN_EMAIL, NEW_PASSWORD)).resolves.toBeDefined();
    await expect(signIn(ADMIN_EMAIL, PASSWORD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuses for a deactivated user', async () => {
    await prisma.forTenant(ACME).user.update({
      where: { id: PRINCIPAL.userId },
      data: { active: false },
    });

    await expect(
      auth.changePassword(
        PRINCIPAL,
        { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
        null,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
