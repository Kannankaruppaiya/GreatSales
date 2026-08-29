import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import type { PlatformJwtClaims } from '@greatsales/shared';
import { PlatformPrismaService } from './platform-prisma.service';
import { PlatformAuthService } from './platform-auth.service';

/**
 * Platform (owner) sign-in, proven against real Postgres. The seeded operator
 * is `super@greatsales.io` / `Passw0rd!` (SuperAdmin). The guarantees mirror
 * the tenant login's: a platform token is minted only for a live account, and
 * failure modes are indistinguishable.
 */
const PASSWORD = 'Passw0rd!';
const OWNER_EMAIL = 'super@greatsales.io';
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;

describe('PlatformAuthService', () => {
  let platformDb: PlatformPrismaService;
  let jwt: JwtService;
  let svc: PlatformAuthService;

  beforeAll(async () => {
    reseedTestDatabase();
    // Platform tables need the OWNER connection — greatsales_app has no grant.
    platformDb = new PlatformPrismaService(process.env.DIRECT_URL as string);
    await platformDb.onModuleInit();
    jwt = new JwtService({});
    svc = new PlatformAuthService(
      platformDb,
      jwt,
      new ConfigService({ JWT_ACCESS_SECRET: ACCESS_SECRET, NODE_ENV: 'test' }),
    );
  }, 120_000);

  afterAll(async () => {
    await platformDb.onModuleDestroy();
  });

  it('issues a platform token (typ=platform, no tid) for the right password', async () => {
    const res = await svc.login({ email: OWNER_EMAIL, password: PASSWORD });

    expect(res.platformUser.email).toBe(OWNER_EMAIL);
    expect(res.platformUser.role).toBe('SuperAdmin');
    expect(res.expiresIn).toBeGreaterThan(0);

    const claims = jwt.verify<PlatformJwtClaims>(res.accessToken, {
      secret: ACCESS_SECRET,
    });
    expect(claims.typ).toBe('platform');
    expect(claims.sub).toBe(res.platformUser.id);
    expect(claims.prole).toBe('SuperAdmin');
    expect((claims as unknown as { tid?: string }).tid).toBeUndefined();
  });

  it('rejects a wrong password', async () => {
    await expect(
      svc.login({ email: OWNER_EMAIL, password: 'nope' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown email with the same error (no account enumeration)', async () => {
    await expect(
      svc.login({ email: 'ghost@greatsales.io', password: PASSWORD }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
