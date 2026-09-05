import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  disconnectOwnerDb,
  setTenantDeletedAt,
  setTenantStatus,
} from '../test-support/owner-db';
import {
  AuthService,
  MAX_FAILED_ATTEMPTS,
  durationMs,
  type IssuedSession,
} from './auth.service';

/**
 * Sign-in security guarantees, proven against real Postgres under the
 * RLS-bound role. These are the assertions that must never regress: they are
 * the difference between a login form and an authentication system.
 *
 * Fixtures come from the deterministic dev seed — tenants `tenant_acme` and
 * `tenant_globex`, every user sharing the password below.
 */
const PASSWORD = 'Passw0rd!';
const ACME = 'tenant_acme';
const GLOBEX = 'tenant_globex';
const ADMIN_EMAIL = 'admin@acme.test';
const SALES1_EMAIL = 'sales1@acme.test';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;

describe('AuthService', () => {
  let prisma: PrismaService;
  let jwt: JwtService;
  let auth: AuthService;

  /** Fresh login helper — most tests need a live session to work from. */
  const signIn = (email = ADMIN_EMAIL, tenantId = ACME, password = PASSWORD) =>
    auth.login({ tenantId, email, password, tokenDelivery: 'cookie' as const });

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    jwt = new JwtService({});
    auth = new AuthService(
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
  }, 120_000);

  afterAll(async () => {
    await disconnectOwnerDb();
    await prisma.onModuleDestroy();
  });

  /**
   * Several tests deliberately lock accounts or suspend tenants. Undo that
   * between tests so ordering never decides the outcome.
   */
  afterEach(async () => {
    const acme = prisma.forTenant(ACME);
    await acme.user.updateMany({
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    const globex = prisma.forTenant(GLOBEX);
    // Owner connection: Tenant is not tenant-scoped, so the runtime role may
    // read it and nothing more (see test-support/owner-db.ts).
    await setTenantStatus(GLOBEX, 'Active');
    await setTenantDeletedAt(GLOBEX, null);
    await globex.user.updateMany({
      data: { active: true, failedLoginAttempts: 0, lockedUntil: null },
    });
  });

  // ================================================================ login: happy

  describe('login — success', () => {
    it('returns an access token, a refresh token, and the profile', async () => {
      const res = await signIn();
      expect(res.accessToken).toEqual(expect.any(String));
      expect(res.refreshTokenValue).toEqual(expect.any(String));
      expect(res.user.email).toBe(ADMIN_EMAIL);
      expect(res.user.tenantId).toBe(ACME);
      expect(res.user.role).toBe('admin');
    });

    it('never exposes the password hash in the profile', async () => {
      const res = await signIn();
      expect(JSON.stringify(res.user)).not.toContain('argon2');
      expect(res.user as Record<string, unknown>).not.toHaveProperty(
        'passwordHash',
      );
    });

    it('reports the access token lifetime so clients need not decode the JWT', async () => {
      const res = await signIn();
      expect(res.expiresIn).toBe(durationMs('15m') / 1000);
    });

    it('persists a refresh-token row whose id is the token jti', async () => {
      const res = await signIn();
      const claims = jwt.verify<{ jti: string; fid: string }>(
        res.refreshTokenValue,
        { secret: REFRESH_SECRET },
      );
      const row = await prisma
        .forTenant(ACME)
        .refreshToken.findUnique({ where: { id: claims.jti } });
      expect(row).not.toBeNull();
      expect(row?.familyId).toBe(claims.fid);
      expect(row?.usedAt).toBeNull();
      expect(row?.revokedAt).toBeNull();
    });

    it('starts a NEW family per login, so one sign-out cannot end another device', async () => {
      const a = await signIn();
      const b = await signIn();
      const fa = jwt.verify<{ fid: string }>(a.refreshTokenValue, {
        secret: REFRESH_SECRET,
      }).fid;
      const fb = jwt.verify<{ fid: string }>(b.refreshTokenValue, {
        secret: REFRESH_SECRET,
      }).fid;
      expect(fa).not.toBe(fb);
    });

    it('records the sign-in and clears any failure counter', async () => {
      const db = prisma.forTenant(ACME);
      await db.user.update({
        where: { id: 'user_admin_acme' },
        data: { failedLoginAttempts: 3 },
      });
      await auth.login(
        {
          tenantId: ACME,
          email: ADMIN_EMAIL,
          password: PASSWORD,
          tokenDelivery: 'cookie',
        },
        { ip: '203.0.113.9' },
      );
      const user = await db.user.findUnique({
        where: { id: 'user_admin_acme' },
      });
      expect(user?.failedLoginAttempts).toBe(0);
      expect(user?.lastIp).toBe('203.0.113.9');
      expect(user?.lastLoginAt).toBeInstanceOf(Date);
    });
  });

  // =============================================================== login: denied

  describe('login — every failure is indistinguishable', () => {
    const expectGenericFailure = async (input: {
      tenantId: string;
      email: string;
      password: string;
    }) => {
      await expect(
        auth.login({ ...input, tokenDelivery: 'cookie' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    };

    it('rejects a wrong password', () =>
      expectGenericFailure({
        tenantId: ACME,
        email: ADMIN_EMAIL,
        password: 'wrong-password',
      }));

    it('rejects an unknown email', () =>
      expectGenericFailure({
        tenantId: ACME,
        email: 'nobody@acme.test',
        password: PASSWORD,
      }));

    it('rejects an unknown tenant', () =>
      expectGenericFailure({
        tenantId: 'tenant_does_not_exist',
        email: ADMIN_EMAIL,
        password: PASSWORD,
      }));

    it('rejects a real user against the WRONG tenant', () =>
      expectGenericFailure({
        tenantId: GLOBEX,
        email: ADMIN_EMAIL, // an acme address
        password: PASSWORD,
      }));

    it('rejects a suspended tenant', async () => {
      await setTenantStatus(GLOBEX, 'Suspended');
      await expectGenericFailure({
        tenantId: GLOBEX,
        email: 'admin@globex.test',
        password: PASSWORD,
      });
    });

    it('rejects a churned tenant', async () => {
      await setTenantStatus(GLOBEX, 'Churned');
      await expectGenericFailure({
        tenantId: GLOBEX,
        email: 'admin@globex.test',
        password: PASSWORD,
      });
    });

    it('rejects a soft-deleted tenant', async () => {
      await setTenantDeletedAt(GLOBEX, new Date());
      await expectGenericFailure({
        tenantId: GLOBEX,
        email: 'admin@globex.test',
        password: PASSWORD,
      });
    });

    it('rejects a deactivated user', async () => {
      await prisma.forTenant(GLOBEX).user.update({
        where: { id: 'user_sales1_globex' },
        data: { active: false },
      });
      await expectGenericFailure({
        tenantId: GLOBEX,
        email: 'sales1@globex.test',
        password: PASSWORD,
      });
    });

    it('rejects an empty password without treating it as a match', () =>
      expectGenericFailure({
        tenantId: ACME,
        email: ADMIN_EMAIL,
        password: ' ',
      }));

    it('issues no refresh-token row on a failed attempt', async () => {
      const db = prisma.forTenant(ACME);
      const before = await db.refreshToken.count();
      await expectGenericFailure({
        tenantId: ACME,
        email: ADMIN_EMAIL,
        password: 'nope',
      });
      expect(await db.refreshToken.count()).toBe(before);
    });
  });

  // ============================================================ timing (D5)

  describe('login — account enumeration', () => {
    /**
     * The bug this guards: skipping the argon2 verify when the user is not
     * found makes the not-found path ~100x faster, so response time tells an
     * attacker which emails are registered.
     *
     * Timing assertions are inherently noisy, so this only asserts the two
     * paths are the same order of magnitude — enough to catch a skipped hash,
     * loose enough not to flake on a busy machine.
     */
    const timeAvg = async (email: string, runs = 5) => {
      const samples: number[] = [];
      for (let i = 0; i < runs; i++) {
        const t0 = process.hrtime.bigint();
        await auth
          .login({
            tenantId: ACME,
            email,
            password: 'definitely-not-the-password',
            tokenDelivery: 'cookie',
          })
          .catch(() => undefined);
        samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
      }
      samples.sort((a, b) => a - b);
      return samples[Math.floor(samples.length / 2)]; // median
    };

    it('takes comparable time for an unknown email and a wrong password', async () => {
      const known = await timeAvg(ADMIN_EMAIL);
      const unknown = await timeAvg('ghost@acme.test');
      // A skipped hash shows up as unknown << known. Allow generous jitter.
      expect(unknown).toBeGreaterThan(known * 0.4);
    }, 60_000);
  });

  // ========================================================== lockout (D6)

  describe('login — brute-force lockout', () => {
    const failOnce = () =>
      auth
        .login({
          tenantId: ACME,
          email: SALES1_EMAIL,
          password: 'wrong',
          tokenDelivery: 'cookie',
        })
        .catch((e: unknown) => e);

    it(`locks the account after ${MAX_FAILED_ATTEMPTS} consecutive failures`, async () => {
      for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await failOnce();
      const err = await failOnce();
      expect(err).toBeInstanceOf(ForbiddenException);
    }, 60_000);

    it('rejects even the CORRECT password while locked', async () => {
      for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await failOnce();
      await expect(signIn(SALES1_EMAIL)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }, 60_000);

    it('does not lock a different account', async () => {
      for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) await failOnce();
      await expect(signIn(ADMIN_EMAIL)).resolves.toBeDefined();
    }, 60_000);

    it('clears the lock once it expires', async () => {
      const db = prisma.forTenant(ACME);
      await db.user.update({
        where: { id: 'user_sales1_acme' },
        data: { lockedUntil: new Date(Date.now() - 1000) },
      });
      await expect(signIn(SALES1_EMAIL)).resolves.toBeDefined();
    });
  });

  // ============================================================ refresh: happy

  describe('refresh — rotation', () => {
    it('issues a new pair and consumes the presented token', async () => {
      const first = await signIn();
      const claims = jwt.verify<{ jti: string; fid: string }>(
        first.refreshTokenValue,
        { secret: REFRESH_SECRET },
      );

      const next = await auth.refresh(first.refreshTokenValue);
      expect(next.refreshTokenValue).not.toBe(first.refreshTokenValue);

      const old = await prisma
        .forTenant(ACME)
        .refreshToken.findUnique({ where: { id: claims.jti } });
      expect(old?.usedAt).toBeInstanceOf(Date);
      expect(old?.replacedById).toEqual(expect.any(String));
    });

    it('keeps the rotated token in the SAME family', async () => {
      const first = await signIn();
      const next = await auth.refresh(first.refreshTokenValue);
      const f1 = jwt.verify<{ fid: string }>(first.refreshTokenValue, {
        secret: REFRESH_SECRET,
      }).fid;
      const f2 = jwt.verify<{ fid: string }>(next.refreshTokenValue, {
        secret: REFRESH_SECRET,
      }).fid;
      expect(f2).toBe(f1);
    });

    it('lets the rotated token itself be rotated again', async () => {
      const a = await signIn();
      const b = await auth.refresh(a.refreshTokenValue);
      const c = await auth.refresh(b.refreshTokenValue);
      expect(c.accessToken).toEqual(expect.any(String));
    });

    it('issues an access token that carries the caller identity', async () => {
      const first = await signIn();
      const next = await auth.refresh(first.refreshTokenValue);
      const claims = jwt.verify<{ sub: string; tid: string; typ: string }>(
        next.accessToken,
        { secret: ACCESS_SECRET },
      );
      expect(claims).toMatchObject({
        sub: 'user_admin_acme',
        tid: ACME,
        typ: 'access',
      });
    });
  });

  // ========================================================= refresh: security

  describe('refresh — theft containment', () => {
    it('revokes the WHOLE family when a consumed token is replayed', async () => {
      const first = await signIn();
      const second = await auth.refresh(first.refreshTokenValue);

      // The attacker replays the token the victim already rotated away from.
      await expect(
        auth.refresh(first.refreshTokenValue),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      // The victim's current, otherwise-valid token is now dead too — the
      // whole session is burned because the credential is known to have leaked.
      await expect(
        auth.refresh(second.refreshTokenValue),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('leaves OTHER sessions of the same user working after a family burn', async () => {
      const laptop = await signIn();
      const phone = await signIn();
      await auth.refresh(laptop.refreshTokenValue);
      await auth.refresh(laptop.refreshTokenValue).catch(() => undefined); // replay → burn

      await expect(
        auth.refresh(phone.refreshTokenValue),
      ).resolves.toBeDefined();
    });

    it('does not fork the family when the same token is refreshed concurrently', async () => {
      const first = await signIn();

      // Two requests present the SAME token at once. Exactly one may rotate;
      // if both did, the family would fork into two live branches.
      const outcomes = await Promise.allSettled([
        auth.refresh(first.refreshTokenValue),
        auth.refresh(first.refreshTokenValue),
      ]);
      const fulfilled = outcomes.filter(
        (
          r,
        ): r is PromiseFulfilledResult<
          Awaited<ReturnType<typeof auth.refresh>>
        > => r.status === 'fulfilled',
      );
      expect(fulfilled).toHaveLength(1);
      expect(outcomes.filter((r) => r.status === 'rejected')).toHaveLength(1);

      // The single winning replacement is the only live branch and rotates on.
      await expect(
        auth.refresh(fulfilled[0].value.refreshTokenValue),
      ).resolves.toBeDefined();
    });

    it('rejects a well-signed token with no matching row', async () => {
      const forged = await jwt.signAsync(
        {
          sub: 'user_admin_acme',
          tid: ACME,
          typ: 'refresh',
          jti: randomUUID(),
          fid: randomUUID(),
        },
        { secret: REFRESH_SECRET, expiresIn: '7d' },
      );
      await expect(auth.refresh(forged)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a token signed with the wrong secret', async () => {
      const bogus = await jwt.signAsync(
        {
          sub: 'user_admin_acme',
          tid: ACME,
          typ: 'refresh',
          jti: 'x',
          fid: 'y',
        },
        { secret: 'an-attacker-controlled-secret-value', expiresIn: '7d' },
      );
      await expect(auth.refresh(bogus)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('refuses an ACCESS token presented as a refresh token', async () => {
      const first = await signIn();
      await expect(auth.refresh(first.accessToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a refresh token whose row has expired', async () => {
      const first = await signIn();
      const { jti } = jwt.verify<{ jti: string }>(first.refreshTokenValue, {
        secret: REFRESH_SECRET,
      });
      await prisma.forTenant(ACME).refreshToken.update({
        where: { id: jti },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await expect(
        auth.refresh(first.refreshTokenValue),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a refresh token whose row was revoked', async () => {
      const first = await signIn();
      const { jti } = jwt.verify<{ jti: string }>(first.refreshTokenValue, {
        secret: REFRESH_SECRET,
      });
      await prisma.forTenant(ACME).refreshToken.update({
        where: { id: jti },
        data: { revokedAt: new Date(), revokedReason: 'test' },
      });
      await expect(
        auth.refresh(first.refreshTokenValue),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects garbage', async () => {
      await expect(auth.refresh('not-a-jwt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  // ================================================ refresh: revalidation (D4)

  describe('refresh — revalidates the account on every rotation', () => {
    const globexSignIn = () =>
      auth.login({
        tenantId: GLOBEX,
        email: 'admin@globex.test',
        password: PASSWORD,
        tokenDelivery: 'cookie',
      });

    it('stops refreshing once the tenant is SUSPENDED', async () => {
      const session = await globexSignIn();
      await setTenantStatus(GLOBEX, 'Suspended');

      await expect(
        auth.refresh(session.refreshTokenValue),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('stops refreshing once the tenant is CHURNED', async () => {
      const session = await globexSignIn();
      await setTenantStatus(GLOBEX, 'Churned');

      await expect(
        auth.refresh(session.refreshTokenValue),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('stops refreshing once the user is deactivated', async () => {
      const session = await auth.login({
        tenantId: GLOBEX,
        email: 'sales1@globex.test',
        password: PASSWORD,
        tokenDelivery: 'cookie',
      });
      await prisma.forTenant(GLOBEX).user.update({
        where: { id: 'user_sales1_globex' },
        data: { active: false },
      });

      await expect(
        auth.refresh(session.refreshTokenValue),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('stops refreshing once the user is locked out', async () => {
      const session = await auth.login({
        tenantId: GLOBEX,
        email: 'sales1@globex.test',
        password: PASSWORD,
        tokenDelivery: 'cookie',
      });
      await prisma.forTenant(GLOBEX).user.update({
        where: { id: 'user_sales1_globex' },
        data: { lockedUntil: new Date(Date.now() + 60_000) },
      });

      await expect(
        auth.refresh(session.refreshTokenValue),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  // ================================================================== logout

  describe('logout', () => {
    it('makes the refresh token stop working immediately', async () => {
      const session = await signIn();
      const res = await auth.logout(session.refreshTokenValue, false, null);
      expect(res.revoked).toBeGreaterThan(0);
      await expect(
        auth.refresh(session.refreshTokenValue),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('revokes the family, so an already-rotated descendant also dies', async () => {
      const first = await signIn();
      const second = await auth.refresh(first.refreshTokenValue);
      await auth.logout(second.refreshTokenValue, false, null);
      await expect(
        auth.refresh(second.refreshTokenValue),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('leaves other devices signed in', async () => {
      const laptop = await signIn();
      const phone = await signIn();
      await auth.logout(laptop.refreshTokenValue, false, null);
      await expect(
        auth.refresh(phone.refreshTokenValue),
      ).resolves.toBeDefined();
    });

    it('signs out everywhere when asked', async () => {
      const laptop = await signIn();
      const phone = await signIn();
      await auth.logout(null as unknown as undefined, true, {
        userId: 'user_admin_acme',
        tenantId: ACME,
        roleId: 'role_admin_acme',
      });
      await expect(
        auth.refresh(laptop.refreshTokenValue),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        auth.refresh(phone.refreshTokenValue),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('never throws on a token it cannot verify', async () => {
      await expect(auth.logout('garbage', false, null)).resolves.toEqual({
        revoked: 0,
      });
      await expect(auth.logout(undefined, false, null)).resolves.toEqual({
        revoked: 0,
      });
    });

    it('is idempotent', async () => {
      const session = await signIn();
      const a = await auth.logout(session.refreshTokenValue, false, null);
      const b = await auth.logout(session.refreshTokenValue, false, null);
      expect(a.revoked).toBeGreaterThan(0);
      expect(b.revoked).toBe(0);
    });
  });

  // ====================================================================== me

  describe('me', () => {
    it('returns the caller profile', async () => {
      const user = await auth.me({
        userId: 'user_admin_acme',
        tenantId: ACME,
        roleId: 'role_admin_acme',
      });
      expect(user.email).toBe(ADMIN_EMAIL);
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('rejects a principal that no longer exists', async () => {
      await expect(
        auth.me({
          userId: 'user_ghost',
          tenantId: ACME,
          roleId: 'role_admin_acme',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('cannot read a user from another tenant', async () => {
      await expect(
        auth.me({
          userId: 'user_admin_globex',
          tenantId: ACME, // RLS scope is acme; the globex row is invisible
          roleId: 'role_admin_acme',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  // ================================================= tenant isolation of tokens

  describe('refresh tokens are tenant-isolated', () => {
    it('does not expose another tenant’s token rows', async () => {
      const acmeSession = await signIn();
      const { jti } = jwt.verify<{ jti: string }>(
        acmeSession.refreshTokenValue,
        { secret: REFRESH_SECRET },
      );
      const seenFromGlobex = await prisma
        .forTenant(GLOBEX)
        .refreshToken.findUnique({ where: { id: jti } });
      expect(seenFromGlobex).toBeNull();
    });
  });

  // ============================================================ duration parser

  describe('durationMs', () => {
    it.each([
      ['15m', 900_000],
      ['7d', 604_800_000],
      ['30s', 30_000],
      ['2h', 7_200_000],
      ['500ms', 500],
      ['900', 900_000],
    ])('parses %s', (input, expected) => {
      expect(durationMs(input)).toBe(expected);
    });

    it('refuses a format it cannot honour rather than guessing', () => {
      expect(() => durationMs('7 weeks')).toThrow();
      expect(() => durationMs('')).toThrow();
    });

    it('matches the persisted expiry to the token TTL', async () => {
      const session: IssuedSession = await signIn();
      const drift = Math.abs(
        session.refreshExpiresAt.getTime() - (Date.now() + durationMs('7d')),
      );
      expect(drift).toBeLessThan(10_000);
    });
  });

  /**
   * Administrative writes in F12 (deactivate, delete, password reset, role
   * change) must be able to end a user's sessions from INSIDE their own
   * transaction, so the change and the revocation cannot come apart. That
   * requires the "revoke everything for this user" logic to be a callable
   * helper rather than a branch buried inside logout().
   */
  describe('revokeAllForUser', () => {
    it('revokes every live family for the user and returns the count', async () => {
      const a = await signIn();
      const b = await signIn();
      expect(a.refreshTokenValue).not.toBe(b.refreshTokenValue);

      const db = prisma.forTenant(ACME);
      const revoked = await auth.revokeAllForUser(
        db,
        'user_admin_acme',
        'admin_deactivated',
      );
      expect(revoked).toBeGreaterThanOrEqual(2);

      await expect(auth.refresh(a.refreshTokenValue)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(auth.refresh(b.refreshTokenValue)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('records the caller-supplied reason, so an operator can see why', async () => {
      await signIn();
      const db = prisma.forTenant(ACME);
      await auth.revokeAllForUser(
        db,
        'user_admin_acme',
        'admin_password_reset',
      );

      const row = await db.refreshToken.findFirst({
        where: {
          userId: 'user_admin_acme',
          revokedReason: 'admin_password_reset',
        },
      });
      expect(row).not.toBeNull();
    });

    it('is idempotent — a second call revokes nothing further', async () => {
      await signIn();
      const db = prisma.forTenant(ACME);
      await auth.revokeAllForUser(db, 'user_admin_acme', 'admin_deleted');
      expect(
        await auth.revokeAllForUser(db, 'user_admin_acme', 'admin_deleted'),
      ).toBe(0);
    });

    it('touches only the named user — another user sessions survive', async () => {
      await signIn();
      const other = await signIn(SALES1_EMAIL);
      const db = prisma.forTenant(ACME);

      await auth.revokeAllForUser(db, 'user_admin_acme', 'admin_deactivated');

      await expect(
        auth.refresh(other.refreshTokenValue),
      ).resolves.toBeDefined();
    });
  });

  /**
   * The web layer decides which controls to render from the caller's
   * permission set. It must come from the server — deriving it from a role
   * NAME on the client would silently break the moment a tenant creates a
   * custom role, which F12 makes possible.
   */
  describe('me — permissions and password state', () => {
    it("returns the admin role's full permission set", async () => {
      const me = await auth.me({
        userId: 'user_admin_acme',
        tenantId: ACME,
        roleId: 'role_admin_acme',
      });
      expect(me.permissions).toEqual(
        expect.arrayContaining(['user.manage', 'role.manage']),
      );
      expect(me.mustChangePassword).toBe(false);
    });

    it("returns a sales role's restricted set, without user.manage", async () => {
      const me = await auth.me({
        userId: 'user_sales1_acme',
        tenantId: ACME,
        roleId: 'role_sales_acme',
      });
      expect(me.permissions).toEqual(
        expect.arrayContaining(['customer.write']),
      );
      expect(me.permissions).not.toContain('user.manage');
      expect(me.permissions).not.toContain('role.manage');
    });

    it('reports mustChangePassword once an admin has set the flag', async () => {
      const db = prisma.forTenant(ACME);
      await db.user.update({
        where: { id: 'user_sales2_acme' },
        data: { mustChangePassword: true },
      });
      const me = await auth.me({
        userId: 'user_sales2_acme',
        tenantId: ACME,
        roleId: 'role_sales_acme',
      });
      expect(me.mustChangePassword).toBe(true);

      await db.user.update({
        where: { id: 'user_sales2_acme' },
        data: { mustChangePassword: false },
      });
    });

    it('carries the same permission set on the login response', async () => {
      // A client must not have to call /auth/me to learn what it may do, and
      // the two sources must never disagree.
      const session = await signIn();
      const me = await auth.me({
        userId: session.user.id,
        tenantId: session.user.tenantId,
        roleId: session.user.roleId,
      });
      expect([...session.user.permissions].sort()).toEqual(
        [...me.permissions].sort(),
      );
    });

    it('never includes a password hash in the profile', async () => {
      const me = await auth.me({
        userId: 'user_admin_acme',
        tenantId: ACME,
        roleId: 'role_admin_acme',
      });
      expect(JSON.stringify(me)).not.toMatch(/passwordHash|\$argon2/);
    });
  });
});
