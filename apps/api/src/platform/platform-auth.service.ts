import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  PlatformLoginInput,
  PlatformLoginResponse,
} from '@greatsales/shared';
import { PlatformPrismaService } from './platform-prisma.service';
import { verifyPassword } from '../auth/hash';
import { durationMs, type AuthContext } from '../auth/auth.service';
import type { PlatformPrincipal } from './platform.decorators';

/**
 * A real argon2id hash of a random value, verified against when the platform
 * account does not exist so the not-found path costs the same as a
 * wrong-password one (mirrors AuthService's DUMMY_HASH — timing must not reveal
 * which platform emails are registered).
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$nYC9H0SbYS8cnQQWhuBfDQ$dEiS+FncrZu00AgZm3HXh6n1XW/fxFkKuDFOSzgKUDU';

/** Platform sessions are short-lived; no refresh flow yet (owner re-auths). */
const PLATFORM_ACCESS_TTL = '1h';

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
  ): Promise<PlatformLoginResponse> {
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

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, prole: user.role, typ: 'platform' },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: PLATFORM_ACCESS_TTL as unknown as number,
      },
    );

    this.log.log(
      JSON.stringify({
        event: 'platform.login.success',
        ip: ctx.ip ?? null,
        platformUserId: user.id,
      }),
    );

    return {
      accessToken,
      expiresIn: Math.floor(durationMs(PLATFORM_ACCESS_TTL) / 1000),
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
