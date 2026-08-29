import { Injectable } from '@nestjs/common';
import type { PermissionKey, RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Resolves a principal's effective permissions from the database (the source of
 * truth: Role → RolePermission → Permission), scoped to the tenant via RLS.
 * Results are cached briefly per (tenant, role) so authorization doesn't cost a
 * query on every request; the short TTL bounds staleness after a grant change.
 */
const CACHE_TTL_MS = 30_000;

export type PrincipalScope = {
  permissions: Set<string>;
  has: (key: PermissionKey) => boolean;
  /**
   * Tenant-wide data visibility. Derived from `report.view` (management/admin
   * oversight): those roles see all of a tenant's records; a salesperson
   * without it sees only their own. Permission-derived, not role-name based.
   */
  canSeeAllData: boolean;
};

@Injectable()
export class AuthzService {
  private readonly cache = new Map<string, { keys: string[]; exp: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async getScope(user: RequestUser): Promise<PrincipalScope> {
    const keys = await this.loadPermissionKeys(user.tenantId, user.roleId);
    const permissions = new Set(keys);
    return {
      permissions,
      has: (key: PermissionKey) => permissions.has(key),
      canSeeAllData: permissions.has('report.view'),
    };
  }

  private async loadPermissionKeys(tenantId: string, roleId: string): Promise<string[]> {
    const cacheKey = `${tenantId}:${roleId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.exp > Date.now()) return cached.keys;

    const db = this.prisma.forTenant(tenantId);
    const rows = await db.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { key: true } } },
    });
    const keys = rows.map((r) => r.permission.key);
    this.cache.set(cacheKey, { keys, exp: Date.now() + CACHE_TTL_MS });
    return keys;
  }
}
