import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionKey, RequestUser } from '@greatsales/shared';
import { PERMISSIONS_KEY } from './require-permission.decorator';
import { AuthzService } from './authz.service';

/**
 * Enforces @RequirePermission on a route. Runs after the global JwtAuthGuard,
 * so `req.user` is present. Routes without the decorator pass through (auth
 * alone governs them). This is the API-layer authorization the RLS backstop
 * does not provide — RLS isolates tenants, this isolates roles within a tenant.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthzService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = ctx.switchToHttp().getRequest<{ user?: RequestUser }>().user;
    if (!user) throw new UnauthorizedException();

    const scope = await this.authz.getScope(user);
    const missing = required.filter((key) => !scope.has(key));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    }
    return true;
  }
}
