import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionKey, RequestUser } from '@greatsales/shared';
import type { AuthenticatedRequest } from './authenticated-request';
import { PrismaService } from '../prisma/prisma.service';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from './decorators';

/**
 * RBAC enforcement. Runs AFTER JwtAuthGuard (so req.user is set), reads the
 * @RequirePermissions keys off the route, and checks them against the caller's
 * role grants — resolved tenant-scoped (RLS) from RolePermission. Routes with no
 * declared permissions pass through. Fail-closed: any gap → 403.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(
      PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    const requiredAny = this.reflector.getAllAndOverride<PermissionKey[]>(
      ANY_PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    const hasAll = !!required && required.length > 0;
    const hasAny = !!requiredAny && requiredAny.length > 0;
    if (!hasAll && !hasAny) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user: RequestUser | undefined = req.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    const role = await this.prisma.forTenant(user.tenantId).role.findUnique({
      where: { id: user.roleId },
      include: { permissions: { include: { permission: true } } },
    });
    const granted = new Set(
      role?.permissions.map((rp) => rp.permission.key) ?? [],
    );

    if (hasAll && !required.every((key) => granted.has(key))) {
      throw new ForbiddenException('Missing required permission');
    }
    if (hasAny && !requiredAny.some((key) => granted.has(key))) {
      throw new ForbiddenException('Missing required permission');
    }
    return true;
  }
}
