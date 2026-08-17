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
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const claims = this.jwt.verify<JwtAccessClaims>(header.slice(7), {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (claims.typ !== 'access') {
        throw new UnauthorizedException('Wrong token type');
      }
      req.user = {
        userId: claims.sub,
        tenantId: claims.tid,
        roleId: claims.roleId,
      } satisfies RequestUser;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
