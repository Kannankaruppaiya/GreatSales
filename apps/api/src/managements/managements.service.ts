import { Injectable, NotFoundException } from '@nestjs/common';
import type { ManagementRow, RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Managements (workspaces) the signed-in user can reach.
 *
 * READ ONLY, and that is a database decision rather than an omission.
 * `20260825160000_lock_global_reference_tables` revokes INSERT/UPDATE/DELETE on
 * `Tenant` from the runtime role, because a tenant-scoped connection able to
 * write the tenancy registry is a cross-tenant privilege-escalation path — a
 * tenant could flip its own `status` from Suspended back to Active, or create
 * workspaces on the platform. `tenant-isolation.spec.ts` asserts that revoke.
 *
 * So creating or renaming a workspace is an OPERATOR action that belongs to the
 * `PlatformUser` layer (which exists in the schema, with its own audit log, but
 * has no auth wired yet). Adding POST here would mean re-granting the write and
 * deleting that test — the wrong trade for a create button.
 *
 * A `User` row also carries exactly one `tenantId`, so `list` returns exactly
 * one row today. The list shape is kept because the caller wants a list and
 * because that is what changes when platform auth lands, not this signature.
 */
@Injectable()
export class ManagementsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: RequestUser): Promise<ManagementRow[]> {
    return [await this.get(user, user.tenantId)];
  }

  async get(user: RequestUser, id: string): Promise<ManagementRow> {
    const db = this.prisma.forTenant(user.tenantId);

    // RLS already restricts `Tenant` to the caller's own row, so a mismatched
    // id finds nothing rather than reading someone else's workspace. The
    // explicit check keeps the failure a 404 instead of a null dereference.
    const tenant = await db.tenant.findFirst({ where: { id } });
    if (!tenant) throw new NotFoundException('Management not found');

    const [userCount, customerCount, productCount] = await db.$transaction([
      db.user.count({ where: { deletedAt: null } }),
      db.customer.count({ where: { deletedAt: null } }),
      db.product.count({ where: { deletedAt: null } }),
    ]);

    return {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      industry: tenant.industry,
      region: tenant.region,
      createdAt: tenant.createdAt.toISOString(),
      userCount,
      customerCount,
      productCount,
    };
  }
}
