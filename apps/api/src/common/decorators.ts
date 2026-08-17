import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';

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
