import type { Request } from 'express';
import type { RequestUser } from '@greatsales/shared';

/**
 * An Express request as it exists AFTER {@link JwtAuthGuard} has run.
 *
 * Nest's `ctx.switchToHttp().getRequest()` returns `any` when it is called
 * without a type argument, and that `any` was propagating through the guards
 * and the `@CurrentUser()` decorator — the exact places that decide which
 * tenant a query is bound to. A typo like `req.user.tenanId` would have
 * compiled and produced `undefined`, and an `undefined` tenant id is a
 * cross-tenant bug, not a crash.
 *
 * Pass this to `getRequest<AuthenticatedRequest>()` at every such call site.
 *
 * `user` is optional on purpose: the property genuinely does not exist on a
 * `@Public()` route, and pretending otherwise would simply move the lie from
 * `any` to a false non-null type. Call sites must handle its absence.
 */
export interface AuthenticatedRequest extends Request {
  user?: RequestUser;
}
