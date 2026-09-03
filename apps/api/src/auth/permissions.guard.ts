import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionKey, RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Declares the permission keys a route requires. The caller's role must grant
 * ALL listed keys. Applied on top of the global JWT guard (which populates
 * req.user); routes with no decorator only require authentication.
 */
export const RequirePermissions = (...keys: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, keys);

interface CacheEntry {
  keys: Set<string>;
  at: number;
}

/**
 * Authorization guard. Resolves the caller's granted permission keys from their
 * role (Role → RolePermission → Permission) under the tenant's RLS scope, and
 * rejects the request unless every key required by the route is present.
 *
 * Grants are cached per-role for a short TTL — permissions change rarely and a
 * DB round-trip on every authorized request would be wasteful — while staying
 * fresh enough that a role edit takes effect within the window.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 60_000;

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(
      PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    const granted = await this.grantsFor(user);
    const missing = required.filter((k) => !granted.has(k));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    }
    return true;
  }

  private async grantsFor(user: RequestUser): Promise<Set<string>> {
    const cached = this.cache.get(user.roleId);
    if (cached && Date.now() - cached.at < this.ttlMs) return cached.keys;

    const db = this.prisma.forTenant(user.tenantId);
    const rows = await db.rolePermission.findMany({
      where: { roleId: user.roleId },
      include: { permission: { select: { key: true } } },
    });
    const keys = new Set(rows.map((r) => r.permission.key));
    this.cache.set(user.roleId, { keys, at: Date.now() });
    return keys;
  }
}
