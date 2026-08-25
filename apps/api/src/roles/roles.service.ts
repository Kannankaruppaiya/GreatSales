import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MODULE_LABELS,
  PERMISSIONS,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  type PermissionGroup,
  type PermissionKey,
  type RequestUser,
  type RoleCreate,
  type RoleRow,
  type RoleUpdate,
} from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import {
  codedBadRequest,
  codedConflict,
  codedNotFound,
} from '../common/error-codes';

/**
 * Prisma include graph carrying everything a {@link RoleRow} needs in ONE
 * query. `_count` is filtered to live users, because a soft-deleted user is
 * not someone the role currently serves — but see {@link RolesService.remove},
 * which deliberately counts them.
 */
const ROLE_INCLUDE = {
  permissions: { include: { permission: true } },
  _count: { select: { users: { where: { deletedAt: null } } } },
} satisfies Prisma.RoleInclude;

type RoleWithGraph = Prisma.RoleGetPayload<{ include: typeof ROLE_INCLUDE }>;

function toRow(role: RoleWithGraph): RoleRow {
  return {
    id: role.id,
    name: role.name,
    isSystem: role.isSystem,
    permissionKeys: role.permissions.map((rp) => rp.permission.key),
    userCount: role._count.users,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

/** Permissions that, between them, make a tenant able to administer itself. */
const ADMIN_PERMISSIONS = ['user.manage', 'role.manage'] as const;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    /** To end sessions when a role's grants change — see {@link update}. */
    private readonly auth: AuthService,
  ) {}

  /**
   * Every role in the tenant, with its real grants and live user count.
   *
   * One query, not one per role: `permissionKeys` and `userCount` both come
   * from the include graph, so adding a role does not add a round trip.
   */
  async list(user: RequestUser): Promise<RoleRow[]> {
    const roles = await this.prisma.forTenant(user.tenantId).role.findMany({
      include: ROLE_INCLUDE,
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return roles.map(toRow);
  }

  /**
   * The permission catalogue, grouped by module for a matrix header.
   *
   * Static — permissions are a property of the software, not of a tenant — so
   * this needs no database round trip and is safe to cache client-side.
   */
  permissions(): PermissionGroup[] {
    const byModule = new Map<string, { key: string; label: string }[]>();
    for (const permission of PERMISSIONS) {
      const list = byModule.get(permission.module) ?? [];
      list.push({
        key: permission.key,
        label: PERMISSION_LABELS[permission.key],
      });
      byModule.set(permission.module, list);
    }
    return [...byModule.entries()].map(([module, permissions]) => ({
      module: MODULE_LABELS[module] ?? module,
      permissions,
    }));
  }

  /** Create a custom role. `isSystem` is never settable by a caller. */
  async create(user: RequestUser, body: RoleCreate): Promise<RoleRow> {
    const permissionIds = await this.resolvePermissionIds(body.permissionKeys);

    return this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      try {
        const role = await tx.role.create({
          data: {
            tenantId: user.tenantId,
            name: body.name.trim(),
            isSystem: false,
            permissions: {
              create: permissionIds.map((permissionId) => ({ permissionId })),
            },
          },
          include: ROLE_INCLUDE,
        });
        await this.audit(tx, user, 'role.created', role.id, null, toRow(role));
        return toRow(role);
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          throw codedConflict(
            'DUPLICATE_IDENTITY',
            'A role with that name already exists in this workspace.',
          );
        }
        throw e;
      }
    });
  }

  /**
   * Rename a role and/or replace its grants.
   *
   * A system role's NAME is protected — other code and documentation refer to
   * `admin`, `mgmt`, `sales` — but its PERMISSIONS are not: a tenant may
   * legitimately want a narrower `mgmt` than the default.
   */
  async update(
    user: RequestUser,
    id: string,
    patch: RoleUpdate,
  ): Promise<RoleRow> {
    const permissionIds =
      patch.permissionKeys !== undefined
        ? await this.resolvePermissionIds(patch.permissionKeys)
        : undefined;

    return this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      const existing = await tx.role.findFirst({
        where: { id },
        include: ROLE_INCLUDE,
      });
      if (!existing) throw codedNotFound('ROLE_NOT_FOUND', 'Role not found.');

      if (patch.name !== undefined && existing.isSystem) {
        throw codedConflict(
          'SYSTEM_ROLE_PROTECTED',
          'Built-in roles cannot be renamed. You can still change what they allow.',
        );
      }

      if (patch.permissionKeys !== undefined) {
        await this.assertAdminPermissionSurvives(
          tx,
          user.tenantId,
          id,
          patch.permissionKeys as PermissionKey[],
        );

        // Wholesale replacement inside the transaction, so a partial grant set
        // is never observable — a caller reading mid-write would otherwise see
        // a role with no permissions at all.
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: (permissionIds ?? []).map((permissionId) => ({
            roleId: id,
            permissionId,
          })),
        });
      }

      if (patch.name !== undefined) {
        try {
          await tx.role.update({
            where: { id },
            data: { name: patch.name.trim() },
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            throw codedConflict(
              'DUPLICATE_IDENTITY',
              'A role with that name already exists in this workspace.',
            );
          }
          throw e;
        }
      }

      const updated = await tx.role.findFirstOrThrow({
        where: { id },
        include: ROLE_INCLUDE,
      });
      await this.audit(
        tx,
        user,
        'role.updated',
        id,
        toRow(existing),
        toRow(updated),
      );

      // The access token carries roleId and its permissions were resolved when
      // it was issued. Narrowing a role must take effect immediately, not
      // whenever the holder's token happens to expire.
      if (patch.permissionKeys !== undefined) {
        const holders = await tx.user.findMany({
          where: { roleId: id, deletedAt: null },
          select: { id: true },
        });
        for (const holder of holders) {
          await this.auth.revokeAllForUser(
            tx,
            holder.id,
            'role_permissions_changed',
          );
        }
      }

      return toRow(updated);
    });
  }

  /**
   * Hard-delete a role.
   *
   * Roles are not soft-deleted. A soft-deleted role would leave `User.roleId`
   * pointing at a row absent from every list, and RBAC would resolve it to an
   * empty permission set — stripping a user's access with no visible cause.
   * Refusing while ANY user references it, soft-deleted ones included, is what
   * keeps that from happening.
   */
  async remove(user: RequestUser, id: string): Promise<void> {
    await this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      const existing = await tx.role.findFirst({
        where: { id },
        include: ROLE_INCLUDE,
      });
      if (!existing) throw codedNotFound('ROLE_NOT_FOUND', 'Role not found.');

      if (existing.isSystem) {
        throw codedConflict(
          'SYSTEM_ROLE_PROTECTED',
          'Built-in roles cannot be deleted.',
        );
      }

      // Counts soft-deleted holders too: their roleId still points here, and a
      // restore would otherwise resurrect them into a role that no longer exists.
      const referencing = await tx.user.count({ where: { roleId: id } });
      if (referencing > 0) {
        throw codedConflict(
          'ROLE_IN_USE',
          `This role is still assigned to ${referencing} user(s). Move them to another role first.`,
        );
      }

      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
      await this.audit(tx, user, 'role.deleted', id, toRow(existing), null);
    });
  }

  // ------------------------------------------------------------------ internals

  /**
   * Maps permission KEYS to ids, refusing anything the system does not define.
   *
   * Validated against the compiled-in catalogue rather than against whatever
   * rows happen to be in the Permission table, so a partially-seeded database
   * cannot silently grant a caller a permission that no guard checks.
   */
  private async resolvePermissionIds(keys: string[]): Promise<string[]> {
    const known = new Set<string>(PERMISSION_KEYS);
    const unknown = keys.filter((k) => !known.has(k));
    if (unknown.length > 0) {
      throw codedBadRequest(
        'INVALID_REFERENCE',
        `Unknown permission(s): ${unknown.join(', ')}.`,
      );
    }

    // Permission is a GLOBAL master table with no RLS, so this needs no tenant
    // scoping — and must not have any, or it would return nothing.
    const rows = await this.prisma.permission.findMany({
      where: { key: { in: keys } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /**
   * Refuses a grant change that would leave the tenant with no POPULATED role
   * able to administer it.
   *
   * "Populated" matters: a role that grants `user.manage` but has no members is
   * no help to anyone locked out. The check runs inside the caller's
   * transaction so two simultaneous narrowings cannot both see the other role
   * as cover.
   */
  private async assertAdminPermissionSurvives(
    tx: Prisma.TransactionClient,
    tenantId: string,
    roleId: string,
    nextKeys: PermissionKey[],
  ): Promise<void> {
    const next = new Set<string>(nextKeys);

    for (const permission of ADMIN_PERMISSIONS) {
      if (next.has(permission)) continue; // this role keeps it — nothing at risk

      const others = await tx.$queryRaw<{ id: string }[]>`
        SELECT r."id"
        FROM "Role" r
        JOIN "RolePermission" rp ON rp."roleId" = r."id"
        JOIN "Permission" p ON p."id" = rp."permissionId"
        JOIN "User" u ON u."roleId" = r."id"
        WHERE r."id" <> ${roleId}
          AND r."tenantId" = ${tenantId}
          AND u."tenantId" = ${tenantId}
          AND p."key" = ${permission}
          AND u."active" = true
          AND u."deletedAt" IS NULL
        LIMIT 1
        FOR UPDATE OF r
      `;
      if (others.length === 0) {
        throw codedConflict(
          'LAST_ADMIN_ROLE_PROTECTED',
          `This is the last role with active users that can "${PERMISSION_LABELS[permission]}". Give another role that permission, and someone to hold it, first.`,
        );
      }
    }
  }

  /** One audit row per role change, inside the caller's transaction. */
  private async audit(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    action: 'role.created' | 'role.updated' | 'role.deleted',
    entityId: string,
    before: RoleRow | null,
    after: RoleRow | null,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action,
        entity: 'Role',
        entityId,
        // Cast because Prisma types Json input as its own union; a RoleRow is
        // a plain object of primitives and string arrays, which is valid JSON.
        before: (before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (after ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
