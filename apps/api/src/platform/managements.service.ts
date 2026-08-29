import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LoginResponse } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, type AuthContext } from '../auth/auth.service';
import { PlatformPrismaService } from './platform-prisma.service';
import type { PlatformPrincipal } from './platform.decorators';

/** What the tenant-side token mint returns, incl. the transport-only refresh. */
type AssumeResult = LoginResponse & {
  refreshTokenValue: string;
  refreshExpiresAt: Date;
};

@Injectable()
export class ManagementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformDb: PlatformPrismaService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Open a management: mint an ordinary tenant session for that tenant's admin
   * user, so the owner operates inside it exactly as an admin would (the
   * "impersonate" model the PlatformAuditLog schema already anticipates). This
   * is the F14 token-exchange.
   *
   * Every read here runs under the TARGET tenant's RLS scope, so an owner can
   * only assume a tenant that genuinely exists and only borrow a user that
   * genuinely belongs to it — the tenant boundary is enforced by the database,
   * not by this code being careful. Authorization to assume AT ALL is the
   * platform-role check on the route; the audit row is written before the
   * session is issued so the intent is recorded even if the mint fails.
   */
  async assume(
    platformUser: PlatformPrincipal,
    managementId: string,
    ctx: AuthContext = {},
  ): Promise<AssumeResult> {
    const db = this.prisma.forTenant(managementId);

    const tenant = await db.tenant.findUnique({ where: { id: managementId } });
    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('Management not found');
    }
    if (tenant.status === 'Suspended' || tenant.status === 'Churned') {
      throw new ForbiddenException('Management is not active');
    }

    const admin = await db.user.findFirst({
      where: {
        deletedAt: null,
        active: true,
        role: { name: 'admin', isSystem: true },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) {
      throw new ForbiddenException(
        'Management has no active admin account to open it as',
      );
    }

    // Audit the assumption BEFORE issuing the session. PlatformAuditLog is a
    // platform table the tenant role cannot write, so it goes through the
    // privileged owner connection.
    await this.platformDb.platformAuditLog.create({
      data: {
        platformUserId: platformUser.id,
        action: 'tenant.impersonate',
        targetType: 'Tenant',
        targetId: managementId,
        tenantId: managementId,
        metadata: { assumedUserId: admin.id, as: 'admin' },
        ip: ctx.ip ?? null,
      },
    });

    return this.auth.issueSessionForUser(managementId, admin.id, ctx);
  }
}
