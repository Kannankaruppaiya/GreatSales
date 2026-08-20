import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { PermissionKey, RequestUser } from '@greatsales/shared';

/** Marks a route as not requiring authentication (skips the global JWT guard). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Injects the authenticated principal (set by JwtAuthGuard). Carries the
 * tenantId that every tenant-scoped Prisma call must be bound to.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);

/**
 * Declares the RBAC permission keys a route requires. Enforced by
 * {@link PermissionsGuard}, which checks them against the caller's role grants.
 * No decorator (or an empty list) means any authenticated user may call it.
 */
export const PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...perms: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);
