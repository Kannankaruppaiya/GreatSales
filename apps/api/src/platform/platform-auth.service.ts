import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  PlatformLoginInput,
  PlatformLoginResponse,
  PlatformRefreshClaims,
} from '@greatsales/shared';
import { PlatformPrismaService } from './platform-prisma.service';
import { verifyPassword } from '../auth/hash';
import { durationMs, type AuthContext } from '../auth/auth.service';
import type { PlatformPrincipal } from './platform.decorators';

/** A platform sign-in result plus the refresh token the controller cookies. */
export type PlatformSession = PlatformLoginResponse & {
  refreshTokenValue: string;
  refreshExpiresAt: Date;
};

type PlatformUserRow = {
  id: string;
  name: string;
  email: string;
  role: PlatformLoginResponse['platformUser']['role'];
};

/**
 * A real argon2id hash of a random value, verified against when the platform
 * account does not exist so the not-found path costs the same as a
 * wrong-password one (mirrors AuthService's DUMMY_HASH — timing must not reveal
 * which platform emails are registered).
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$nYC9H0SbYS8cnQQWhuBfDQ$dEiS+FncrZu00AgZm3HXh6n1XW/fxFkKuDFOSzgKUDU';

/** Access token lifetime — short; the refresh cookie renews it. */
const PLATFORM_ACCESS_TTL = '1h';

/**
 * Refresh-cookie lifetime. Bounded to a working day rather than the tenant
 * flow's 7d: this is a STATELESS refresh (no server-side rotation family, so no
 * replay revocation), so the exposure window is kept short. Making it stateful
 * — a PlatformRefreshToken table mirroring RefreshToken — is the hardening
 * follow-up; until then this restores an owner's session across a reload
 * without the 7-day liability.
 */
const PLATFORM_REFRESH_TTL = '12h';

@Injectable()
export class PlatformAuthService {
  private readonly log = new Logger('PlatformAuth');

  constructor(
    private readonly prisma: PlatformPrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Authenticate a platform user by globally-unique email. Failure modes are
   * indistinguishable ("Invalid credentials") and pay the same argon2 cost, so
   * neither message nor latency reveals whether an account exists.
   */
  async login(
    input: PlatformLoginInput,
    ctx: AuthContext = {},
  ): Promise<PlatformSession> {
    const user = await this.prisma.platformUser.findUnique({
      where: { email: input.email },
    });
    const ok = await verifyPassword(
      user?.passwordHash ?? DUMMY_HASH,
      input.password,
    );
    if (!user || user.deletedAt || !user.active || !ok) {
      this.log.log(
        JSON.stringify({
          event: 'platform.login.failed',
          ip: ctx.ip ?? null,
          accountExists: !!user,
        }),
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastIp: ctx.ip ?? null },
    });

    this.log.log(
      JSON.stringify({
        event: 'platform.login.success',
        ip: ctx.ip ?? null,
        platformUserId: user.id,
      }),
    );

    return this.issue(user);
  }

  /**
   * Exchange a platform refresh token (from the httpOnly cookie) for a fresh
   * access + refresh pair. Stateless: the token's signature and expiry are the
   * whole check, plus a re-read that the account is still live — a deactivated
   * owner cannot refresh their way back in.
   */
  async refresh(token: string): Promise<PlatformSession> {
    let claims: PlatformRefreshClaims;
    try {
      claims = await this.jwt.verifyAsync<PlatformRefreshClaims>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid platform refresh token');
    }
    if (claims.typ !== 'platform_refresh') {
      throw new UnauthorizedException('Wrong token type');
    }

    const user = await this.prisma.platformUser.findFirst({
      where: { id: claims.sub, deletedAt: null, active: true },
    });
    if (!user) {
      throw new UnauthorizedException('Platform user is no longer active');
    }
    return this.issue(user);
  }

  /** Mint the access token + rotated refresh token for a verified platform user. */
  private async issue(user: PlatformUserRow): Promise<PlatformSession> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, prole: user.role, typ: 'platform' },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: PLATFORM_ACCESS_TTL as unknown as number,
      },
    );
    const refreshTokenValue = await this.jwt.signAsync(
      { sub: user.id, typ: 'platform_refresh' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: PLATFORM_REFRESH_TTL as unknown as number,
      },
    );
    return {
      accessToken,
      expiresIn: Math.floor(durationMs(PLATFORM_ACCESS_TTL) / 1000),
      refreshTokenValue,
      refreshExpiresAt: new Date(Date.now() + durationMs(PLATFORM_REFRESH_TTL)),
      platformUser: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  /** The current platform principal, straight from the validated token. */
  me(principal: PlatformPrincipal): PlatformLoginResponse['platformUser'] {
    return {
      id: principal.id,
      name: principal.name,
      email: principal.email,
      role: principal.role,
    };
  }
}
