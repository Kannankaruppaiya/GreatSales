import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type {
  CreateManagementInput,
  CreateManagementResponse,
  LoginResponse,
  ManagementListResponse,
  ManagementSummary,
} from '@greatsales/shared';
import { ROLE_PERMISSIONS, SYSTEM_ROLES } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, type AuthContext } from '../auth/auth.service';
import { hashPassword } from '../auth/hash';
import { PlatformPrismaService } from './platform-prisma.service';
import type { PlatformPrincipal } from './platform.decorators';

/** Reads a string field off a Tenant.config JSON blob, defensively. */
function configString(config: unknown, key: string): string | null {
  if (config && typeof config === 'object' && key in config) {
    const v = (config as Record<string, unknown>)[key];
    return typeof v === 'string' ? v : null;
  }
  return null;
}

/**
 * A strong one-time password for a provisioned admin. Not shown to satisfy a
 * policy check — the admin must change it on first sign-in — but random enough
 * that the window before that is not a weakness. The fixed suffix guarantees a
 * mixed character class regardless of the random draw.
 */
function generateTempPassword(): string {
  return `${randomBytes(12).toString('base64url')}Aa1!`;
}

/** Local part of an email, sanitised into a first username for a fresh tenant. */
function usernameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'admin';
  return local.toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'admin';
}

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
   * List every management (tenant) with its headline stats. This is the one
   * genuinely cross-tenant read in the app, so it runs on the privileged owner
   * connection — the only role that sees past FORCE RLS on Tenant. Stats are
   * gathered with two grouped queries rather than a per-tenant loop.
   */
  async list(): Promise<ManagementListResponse> {
    const tenants = await this.platformDb.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const [userGroups, salesGroups] = await Promise.all([
      this.platformDb.user.groupBy({
        by: ['tenantId'],
        where: { deletedAt: null, active: true },
        _count: { _all: true },
      }),
      this.platformDb.salesOrder.groupBy({
        by: ['tenantId'],
        where: { deletedAt: null, date: { gte: startOfMonth } },
        _sum: { total: true },
      }),
    ]);

    const users = new Map(userGroups.map((g) => [g.tenantId, g._count._all]));
    const sales = new Map(
      salesGroups.map((g) => [g.tenantId, g._sum.total?.toNumber() ?? 0]),
    );

    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      region: t.region,
      industry: t.industry,
      currency: configString(t.config, 'currency'),
      userCount: users.get(t.id) ?? 0,
      salesThisMonth: sales.get(t.id) ?? 0,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  /**
   * Provision a new management: a Tenant plus its three system roles + the
   * shared permission matrix + a first admin who must change their password on
   * first sign-in. Runs as ONE owner transaction — a half-created tenant (roles
   * but no admin, say) would be worse than none — and is audited.
   *
   * Tenant is a write the tenant role is REVOKED from, and this spans no single
   * tenant's RLS scope, so it necessarily runs on the owner connection.
   */
  async create(
    platformUser: PlatformPrincipal,
    input: CreateManagementInput,
    ctx: AuthContext = {},
  ): Promise<CreateManagementResponse> {
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const permissions = await this.platformDb.permission.findMany({
      select: { id: true, key: true },
    });
    const permId = new Map(permissions.map((p) => [p.key, p.id]));

    const tenant = await this.platformDb.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name: input.name,
          status: 'Trial',
          region: input.region ?? null,
          industry: input.industry ?? null,
          accountManagerId: platformUser.id,
          config: {
            currency: input.currency ?? null,
            timezone: input.timezone ?? null,
            fiscalYearStart: input.fiscalYearStart ?? null,
          },
        },
      });

      let adminRoleId = '';
      for (const roleName of SYSTEM_ROLES) {
        const role = await tx.role.create({
          data: { tenantId: created.id, name: roleName, isSystem: true },
        });
        if (roleName === 'admin') adminRoleId = role.id;
        const grants = ROLE_PERMISSIONS[roleName]
          .map((key) => permId.get(key))
          .filter((id): id is string => !!id)
          .map((permissionId) => ({ roleId: role.id, permissionId }));
        if (grants.length) await tx.rolePermission.createMany({ data: grants });
      }

      await tx.user.create({
        data: {
          tenantId: created.id,
          name: input.adminName,
          email: input.adminEmail,
          username: usernameFromEmail(input.adminEmail),
          passwordHash,
          roleId: adminRoleId,
          mustChangePassword: true,
        },
      });

      await tx.platformAuditLog.create({
        data: {
          platformUserId: platformUser.id,
          action: 'tenant.create',
          targetType: 'Tenant',
          targetId: created.id,
          tenantId: created.id,
          metadata: { adminEmail: input.adminEmail },
          ip: ctx.ip ?? null,
        },
      });

      return created;
    });

    const management: ManagementSummary = {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      region: tenant.region,
      industry: tenant.industry,
      currency: configString(tenant.config, 'currency'),
      userCount: 1,
      salesThisMonth: 0,
      createdAt: tenant.createdAt.toISOString(),
    };

    return { management, adminEmail: input.adminEmail, tempPassword };
  }

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
