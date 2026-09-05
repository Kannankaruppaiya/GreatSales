import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { PlatformJwtClaims, PlatformRoleValue } from '@greatsales/shared';
import { PlatformPrismaService } from './platform-prisma.service';
import {
  PLATFORM_ROLES_KEY,
  type PlatformRequest,
} from './platform.decorators';

/**
 * Authenticates a PLATFORM principal (owner / super-admin), the counterpart to
 * the tenant JwtAuthGuard. Applied per-controller (not global): platform routes
 * opt out of the tenant guard chain with @Public() and use this instead.
 *
 * A platform token is verified with the same access secret but must carry
 * `typ: "platform"` — the tenant guard requires `typ: "access"`, so neither
 * token is ever accepted where the other belongs. The principal is re-read from
 * the database on every request so a deactivated owner cannot keep operating on
 * a still-valid token.
 */
@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PlatformPrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<PlatformRequest>();
    const header = req.headers.authorization;
    const bearer = typeof header === 'string' ? header : undefined;
    if (!bearer?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing platform bearer token');
    }

    let claims: PlatformJwtClaims;
    try {
      claims = this.jwt.verify<PlatformJwtClaims>(bearer.slice(7), {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired platform token');
    }
    if (claims.typ !== 'platform') {
      throw new UnauthorizedException('Wrong token type');
    }

    // PlatformUser is a platform table the tenant role has no grant on, so it
    // is read through the privileged owner connection.
    const user = await this.prisma.platformUser.findFirst({
      where: { id: claims.sub, deletedAt: null, active: true },
    });
    if (!user) {
      throw new UnauthorizedException('Platform user is no longer active');
    }

    req.platformUser = {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    };

    const required = this.reflector.getAllAndOverride<PlatformRoleValue[]>(
      PLATFORM_ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (required?.length && !required.includes(user.role)) {
      throw new ForbiddenException('Insufficient platform role');
    }
    return true;
  }
}
