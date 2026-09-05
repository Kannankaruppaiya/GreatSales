import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { PlatformRoleValue } from '@greatsales/shared';

/**
 * The authenticated platform principal, attached to the request by
 * {@link PlatformAuthGuard}. Distinct from the tenant `RequestUser`: a platform
 * user has no tenant, and carries a platform role instead of a tenant roleId.
 */
export interface PlatformPrincipal {
  id: string;
  role: PlatformRoleValue;
  name: string;
  email: string;
}

/** Request shape once the platform guard has run. */
export interface PlatformRequest {
  platformUser?: PlatformPrincipal;
  headers: Record<string, string | string[] | undefined>;
}

/** Injects the authenticated platform principal. */
export const CurrentPlatformUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformPrincipal => {
    return ctx.switchToHttp().getRequest<PlatformRequest>().platformUser!;
  },
);

/**
 * Declares which platform roles may call a route. Enforced by
 * {@link PlatformAuthGuard}. Absent = any authenticated platform user.
 */
export const PLATFORM_ROLES_KEY = 'requiredPlatformRoles';
export const RequirePlatformRole = (...roles: PlatformRoleValue[]) =>
  SetMetadata(PLATFORM_ROLES_KEY, roles);
