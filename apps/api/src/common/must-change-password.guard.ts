import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { codedForbidden } from './error-codes';

/**
 * Marks the few routes a user with a pending forced password change may still
 * reach: discovering their own state, changing the password, and signing out.
 *
 * Anything else must be unreachable, or the gate is decoration.
 */
export const ALLOW_PENDING_KEY = 'allowPasswordChangePending';
export const AllowPasswordChangePending = () =>
  SetMetadata(ALLOW_PENDING_KEY, true);

/**
 * Enforces the forced-password-change state SERVER-SIDE.
 *
 * `mustChangePassword` is returned to the client so the UI can route the user
 * to the change screen — but a client that ignores it must not receive data.
 * This guard is that enforcement.
 *
 * Reads the flag from the database rather than trusting the access token,
 * because an admin may set it AFTER a token was issued; a stale token must not
 * outlive the decision. The cost is one primary-key read per authenticated
 * request, on an index Postgres already keeps hot.
 *
 * Registered after JwtAuthGuard (so `req.user` exists) and before
 * PermissionsGuard — a user who must change their password should not even
 * reach a permission check.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const exempt = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (exempt) return true;

    const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    // Unauthenticated or @Public() routes are not this guard's concern; the
    // JWT guard has already decided whether they may proceed.
    if (!user) return true;

    const row = await this.prisma.forTenant(user.tenantId).user.findFirst({
      where: { id: user.userId },
      select: { mustChangePassword: true },
    });

    if (row?.mustChangePassword) {
      throw codedForbidden(
        'PASSWORD_CHANGE_REQUIRED',
        'You must change your password before continuing.',
      );
    }
    return true;
  }
}
