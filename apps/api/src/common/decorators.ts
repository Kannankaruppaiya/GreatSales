import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
  SetMetadata,
} from '@nestjs/common';
import type { PermissionKey, RequestUser } from '@greatsales/shared';
import type { AuthenticatedRequest } from './authenticated-request';

/** Marks a route as not requiring authentication (skips the global JWT guard). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Injects the authenticated principal (set by JwtAuthGuard). Carries the
 * tenantId that every tenant-scoped Prisma call must be bound to.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) {
      // Reachable only by using @CurrentUser() on a @Public() route, i.e. a
      // programming error. Returning undefined here would hand a downstream
      // query an undefined tenantId, so fail loudly instead.
      throw new InternalServerErrorException(
        '@CurrentUser() used on a route that is not behind JwtAuthGuard',
      );
    }
    return req.user;
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

/**
 * Declares that a route requires ANY ONE of the listed permissions.
 *
 * Distinct from {@link RequirePermissions}, which requires ALL of them.
 * Reading the role list is the motivating case: the user editor needs it to
 * populate a dropdown, so `user.manage` must be enough — while every WRITE to
 * a role still demands `role.manage`. Collapsing the two would either lock an
 * admin out of their own user form or hand out role editing by accident.
 */
export const ANY_PERMISSIONS_KEY = 'requiredAnyPermissions';
export const RequireAnyPermission = (...perms: PermissionKey[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, perms);
