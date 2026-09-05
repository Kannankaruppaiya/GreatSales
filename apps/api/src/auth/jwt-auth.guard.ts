import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { JwtAccessClaims, RequestUser } from '@greatsales/shared';
import { IS_PUBLIC_KEY } from '../common/decorators';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Global guard. Rejects any request without a valid access token, except routes
 * marked @Public(). On success it attaches `req.user` (the tenant + user ids),
 * which every downstream tenant-scoped Prisma call binds to.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let claims: JwtAccessClaims;
    try {
      claims = this.jwt.verify<JwtAccessClaims>(header.slice(7), {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (claims.typ !== 'access') {
      throw new UnauthorizedException('Wrong token type');
    }

    // Re-validate the user against the live row so an access token cannot
    // outlive the account state it was minted under. Signature + TTL alone
    // leave a stale token authorized for up to the access TTL after the user
    // is deactivated/deleted or has their role or password changed. This is one
    // primary-key lookup per request, scoped by RLS to the token's tenant; a
    // future optimisation could cache it by (userId, tokenVersion).
    const user = await this.prisma.transactionForTenant(claims.tid, (tx) =>
      tx.user.findUnique({
        where: { id: claims.sub },
        select: { active: true, deletedAt: true, tokenVersion: true },
      }),
    );
    // A missing `tv` claim (token minted before the version existed) is treated
    // as version 0, matching a never-bumped user — no forced re-login on deploy.
    if (
      !user ||
      user.deletedAt !== null ||
      !user.active ||
      user.tokenVersion !== (claims.tv ?? 0)
    ) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    req.user = {
      userId: claims.sub,
      tenantId: claims.tid,
      roleId: claims.roleId,
    } satisfies RequestUser;
    return true;
  }
}
