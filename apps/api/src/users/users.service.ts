import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  UserCreate,
  UserResetPassword,
  UserListQuery,
  UserListResponse,
  UserRow,
  UserUpdate,
  RequestUser,
} from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from '../auth/hash';
import { AuthService } from '../auth/auth.service';
import { codedConflict, codedNotFound } from '../common/error-codes';
import { auditUser, revocationReason } from './users.audit';
import {
  assertManagerAcyclic,
  assertNotLastAdmin,
  assertNotSelfDangerous,
  assertPasswordPolicy,
  mapPrismaWriteError,
  normalizeIdentity,
} from './user-invariants';

/** Prisma include graph that carries everything a {@link UserRow} needs. */
const USER_INCLUDE = {
  role: true,
  manager: true,
  team: true,
} satisfies Prisma.UserInclude;

type UserWithGraph = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;

/** Public-safe projection — deliberately drops passwordHash. */
function toRow(u: UserWithGraph): UserRow {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    roleId: u.roleId,
    roleName: u.role.name,
    managerId: u.managerId,
    managerName: u.manager?.name ?? null,
    teamId: u.teamId,
    teamName: u.team?.name ?? null,
    active: u.active,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    deletedAt: u.deletedAt?.toISOString() ?? null,
  };
}

/**
 * The single translation from list query to Prisma filter.
 *
 * Extracted so the page query and the total count cannot diverge: if they were
 * written twice, a mismatch would show "12 users" above a table containing
 * eight, and nothing would catch it.
 */
export function buildUserWhere(query: UserListQuery): Prisma.UserWhereInput {
  // Read through an explicit fallback rather than trusting the field to be
  // present. ZodValidationPipe supplies these defaults on the HTTP path, but a
  // caller that omitted `status` would otherwise be read as
  // `active: (undefined === 'active')` — i.e. silently filtered to INACTIVE
  // users. A wrong answer is worse than a missing one.
  const status = query.status ?? 'all';
  return {
    ...(query.includeDeleted === 'true' ? {} : { deletedAt: null }),
    ...(query.roleId ? { roleId: query.roleId } : {}),
    ...(query.teamId ? { teamId: query.teamId } : {}),
    ...(status === 'all' ? {} : { active: status === 'active' }),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { username: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    /**
     * Injected so an administrative write can end the target's sessions from
     * inside its own transaction. Without that atomicity a crash between the
     * two would leave a disabled account with live sessions.
     */
    private readonly auth: AuthService,
  ) {}

  /**
   * Tenant-scoped (RLS) user list.
   *
   * Keyset-paginated on (sortField, id). The secondary key on `id` matters:
   * without it, two users with the same name would have no defined order
   * between them, and a cursor could skip or repeat rows across pages.
   *
   * The page and the total are read inside ONE transaction, so the count in
   * the header cannot disagree with the rows below it.
   */
  async list(
    user: RequestUser,
    query: UserListQuery,
  ): Promise<UserListResponse> {
    const db = this.prisma.forTenant(user.tenantId);
    const where = buildUserWhere(query);
    // Same reasoning as buildUserWhere: fall back explicitly rather than
    // letting `{ [undefined]: undefined }` reach Prisma.
    const sort = query.sort ?? 'name';
    const dir = query.dir ?? 'asc';
    const orderBy = [
      { [sort]: dir },
      { id: dir },
    ] as Prisma.UserOrderByWithRelationInput[];

    const [rows, total] = await db.$transaction([
      db.user.findMany({
        where,
        include: USER_INCLUDE,
        orderBy,
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      db.user.count({ where }),
    ]);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map(toRow),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      total,
    };
  }

  /**
   * Create a tenant user.
   *
   * `mustChangePassword` is set unconditionally: an admin-chosen password is a
   * shared secret from the moment it is typed, so the user must replace it
   * before the account is theirs alone.
   */
  async create(user: RequestUser, raw: UserCreate): Promise<UserRow> {
    const body = normalizeIdentity(raw);
    assertPasswordPolicy(body.password, {
      name: body.name,
      email: body.email,
      username: body.username,
    });

    const db = this.prisma.forTenant(user.tenantId);
    if (body.managerId) await assertManagerAcyclic(db, null, body.managerId);

    const passwordHash = await hashPassword(body.password);

    return this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      try {
        const created = await tx.user.create({
          data: {
            tenant: { connect: { id: user.tenantId } },
            name: body.name,
            email: body.email,
            username: body.username,
            passwordHash,
            mustChangePassword: true,
            role: { connect: { id: body.roleId } },
            ...(body.active !== undefined ? { active: body.active } : {}),
            ...(body.managerId
              ? { manager: { connect: { id: body.managerId } } }
              : {}),
            ...(body.teamId ? { team: { connect: { id: body.teamId } } } : {}),
          },
          include: USER_INCLUDE,
        });
        await auditUser(tx, user, 'user.created', created.id, null, created);
        return toRow(created);
      } catch (e) {
        mapPrismaWriteError(e);
      }
    });
  }

  /** Partial edit; a supplied `password` is re-hashed, never stored raw. */
  async update(
    user: RequestUser,
    id: string,
    rawPatch: UserUpdate,
  ): Promise<UserRow> {
    const patch = normalizeIdentity(rawPatch);
    // Cheapest check first, and the only one that needs no database read.
    assertNotSelfDangerous(user.userId, id, patch);

    const db = this.prisma.forTenant(user.tenantId);

    const existing = await db.user.findFirst({
      where: { id, deletedAt: null },
      include: USER_INCLUDE,
    });
    if (!existing) throw codedNotFound('USER_NOT_FOUND', 'User not found.');

    if (patch.password !== undefined) {
      // Checked against the identity the user will HAVE after this patch, not
      // the one they had before — otherwise renaming and re-crediting in one
      // call could smuggle the new name into the new password.
      assertPasswordPolicy(patch.password, {
        name: patch.name ?? existing.name,
        email: patch.email ?? existing.email,
        username: patch.username ?? existing.username,
      });
    }

    // Argon2 costs ~50ms. Hashing here rather than inside the transaction
    // keeps that cost off the row locks the last-admin guard is about to take.
    const passwordHash =
      patch.password !== undefined
        ? await hashPassword(patch.password)
        : undefined;

    const data: Prisma.UserUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.email !== undefined) data.email = patch.email;
    if (patch.username !== undefined) data.username = patch.username;
    if (patch.active !== undefined) data.active = patch.active;
    if (passwordHash !== undefined) data.passwordHash = passwordHash;
    if (patch.roleId !== undefined)
      data.role = { connect: { id: patch.roleId } };
    if ('managerId' in patch) {
      data.manager = patch.managerId
        ? { connect: { id: patch.managerId } }
        : { disconnect: true };
    }
    if ('teamId' in patch) {
      data.team = patch.teamId
        ? { connect: { id: patch.teamId } }
        : { disconnect: true };
    }

    // One tenant-scoped transaction so the guards and the write see the same
    // snapshot. transactionForTenant (not db.$transaction) because the
    // last-admin guard uses $queryRaw, which the forTenant extension does not
    // cover — an unscoped raw query would read zero rows under RLS and the
    // guard would pass when it must not.
    //
    // The FOR UPDATE lock it takes over the surviving-admin set is held for
    // this transaction, forcing two concurrent removals to serialise instead
    // of both reading "one other admin remains".
    return this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      if (patch.managerId) await assertManagerAcyclic(tx, id, patch.managerId);
      if (patch.active !== undefined || patch.roleId !== undefined) {
        await assertNotLastAdmin(tx, user.tenantId, id, {
          roleId: patch.roleId,
          active: patch.active,
        });
      }

      try {
        const updated = await tx.user.update({
          where: { id },
          data,
          include: USER_INCLUDE,
        });
        await auditUser(tx, user, 'user.updated', id, existing, updated);

        // Deactivation, a role change, and a new credential each invalidate
        // what an outstanding token asserts. The refresh path re-checks
        // `active` only on its NEXT use, and the access token carries roleId
        // outright, so without this the change takes effect only when the
        // token happens to expire.
        const endsSessions =
          patch.active === false ||
          patch.roleId !== undefined ||
          patch.password !== undefined;
        if (endsSessions) {
          await this.auth.revokeAllForUser(tx, id, revocationReason(patch));
        }

        return toRow(updated);
      } catch (e) {
        mapPrismaWriteError(e);
      }
    });
  }

  /** Soft-delete: set deletedAt so the row drops out of every list. */
  async remove(user: RequestUser, id: string): Promise<void> {
    assertNotSelfDangerous(user.userId, id, {}, true);

    await this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id, deletedAt: null },
        include: USER_INCLUDE,
      });
      if (!existing) throw codedNotFound('USER_NOT_FOUND', 'User not found.');

      await assertNotLastAdmin(tx, user.tenantId, id, { deleting: true });
      const deleted = await tx.user.update({
        where: { id },
        data: { deletedAt: new Date() },
        include: USER_INCLUDE,
      });
      await auditUser(tx, user, 'user.deleted', id, existing, deleted);
      await this.auth.revokeAllForUser(tx, id, 'admin_deleted');
    });
  }

  /**
   * One user by id.
   *
   * A cross-tenant id is invisible under RLS, so this answers 404 — which is
   * also the correct answer on its own terms: the API must not confirm that an
   * id exists in a workspace the caller cannot see.
   */
  async get(
    user: RequestUser,
    id: string,
    includeDeleted: boolean,
  ): Promise<UserRow> {
    const found = await this.prisma.forTenant(user.tenantId).user.findFirst({
      where: { id, ...(includeDeleted ? {} : { deletedAt: null }) },
      include: USER_INCLUDE,
    });
    if (!found) throw codedNotFound('USER_NOT_FOUND', 'User not found.');
    return toRow(found);
  }

  /**
   * Un-delete a soft-deleted user.
   *
   * Deleting frees the email and username for reuse, so by the time someone
   * restores, that identity may belong to a different person. The partial
   * unique index catches exactly this, and P2002 becomes a 409 that names the
   * remedy rather than an opaque 500.
   */
  async restore(user: RequestUser, id: string): Promise<UserRow> {
    return this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id, deletedAt: { not: null } },
        include: USER_INCLUDE,
      });
      if (!existing) {
        throw codedNotFound('USER_NOT_FOUND', 'No deleted user with that id.');
      }

      try {
        const restored = await tx.user.update({
          where: { id },
          data: { deletedAt: null },
          include: USER_INCLUDE,
        });
        await auditUser(tx, user, 'user.restored', id, existing, restored);
        return toRow(restored);
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          throw codedConflict(
            'RESTORE_CONFLICT',
            'That email or username has been taken by another user since this one was deleted. Change theirs first.',
          );
        }
        throw e;
      }
    });
  }

  /**
   * Admin-initiated password reset.
   *
   * Forces a change on next sign-in, because from this moment the admin knows
   * the credential too, and revokes every session: if the reset is a response
   * to a compromise, leaving the attacker signed in would defeat it entirely.
   *
   * Refuses on your OWN account. Changing your own password belongs on
   * /auth/change-password, which requires the current one — routing it through
   * here would let a stolen access token take the account over outright.
   */
  async resetPassword(
    user: RequestUser,
    id: string,
    body: UserResetPassword,
  ): Promise<{ mustChangePassword: true }> {
    assertNotSelfDangerous(user.userId, id, {}, true);

    const db = this.prisma.forTenant(user.tenantId);
    const target = await db.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, email: true, username: true },
    });
    if (!target) throw codedNotFound('USER_NOT_FOUND', 'User not found.');

    assertPasswordPolicy(body.password, target);
    const passwordHash = await hashPassword(body.password);

    await this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true },
      });
      await auditUser(tx, user, 'user.password_reset', id, target, updated);
      await this.auth.revokeAllForUser(tx, id, 'admin_password_reset');
    });

    return { mustChangePassword: true };
  }
}
