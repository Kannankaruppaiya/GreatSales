import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  RequestUser,
  TeamCreate,
  TeamMembers,
  TeamRow,
  TeamUpdate,
  UserRow,
} from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { codedBadRequest, codedNotFound } from '../common/error-codes';

/**
 * One query's worth of everything a {@link TeamRow} needs. Member count is
 * filtered to live users: a soft-deleted person is not on the team.
 */
const TEAM_INCLUDE = {
  manager: { select: { name: true } },
  _count: { select: { members: { where: { deletedAt: null } } } },
} satisfies Prisma.TeamInclude;

type TeamWithGraph = Prisma.TeamGetPayload<{ include: typeof TEAM_INCLUDE }>;

function toRow(team: TeamWithGraph): TeamRow {
  return {
    id: team.id,
    name: team.name,
    managerId: team.managerId,
    managerName: team.manager.name,
    memberCount: team._count.members,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };
}

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every live team in the tenant, with manager and member count. */
  async list(user: RequestUser): Promise<TeamRow[]> {
    const teams = await this.prisma.forTenant(user.tenantId).team.findMany({
      where: { deletedAt: null },
      include: TEAM_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return teams.map(toRow);
  }

  async create(user: RequestUser, body: TeamCreate): Promise<TeamRow> {
    const db = this.prisma.forTenant(user.tenantId);
    await this.assertManagerUsable(db, body.managerId);

    return this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      const team = await tx.team.create({
        data: {
          tenantId: user.tenantId,
          name: body.name.trim(),
          managerId: body.managerId,
        },
        include: TEAM_INCLUDE,
      });
      await this.audit(tx, user, 'team.created', team.id, null, toRow(team));
      return toRow(team);
    });
  }

  async update(
    user: RequestUser,
    id: string,
    patch: TeamUpdate,
  ): Promise<TeamRow> {
    const db = this.prisma.forTenant(user.tenantId);
    if (patch.managerId) await this.assertManagerUsable(db, patch.managerId);

    return this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      const existing = await tx.team.findFirst({
        where: { id, deletedAt: null },
        include: TEAM_INCLUDE,
      });
      if (!existing) throw codedNotFound('TEAM_NOT_FOUND', 'Team not found.');

      const updated = await tx.team.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
          ...(patch.managerId !== undefined
            ? { managerId: patch.managerId }
            : {}),
        },
        include: TEAM_INCLUDE,
      });
      await this.audit(
        tx,
        user,
        'team.updated',
        id,
        toRow(existing),
        toRow(updated),
      );
      return toRow(updated);
    });
  }

  /**
   * Soft-delete a team, detaching every member in the same transaction.
   *
   * Without the detach, `User.teamId` would point at a team that appears in no
   * list, and the users table would keep rendering a team name for a team that
   * no longer exists — a lie the operator has no way to correct.
   */
  async remove(user: RequestUser, id: string): Promise<void> {
    await this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      const existing = await tx.team.findFirst({
        where: { id, deletedAt: null },
        include: TEAM_INCLUDE,
      });
      if (!existing) throw codedNotFound('TEAM_NOT_FOUND', 'Team not found.');

      await tx.user.updateMany({
        where: { teamId: id },
        data: { teamId: null },
      });
      await tx.team.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.audit(tx, user, 'team.deleted', id, toRow(existing), null);
    });
  }

  /** Live members of one team. Never carries a password hash. */
  async members(user: RequestUser, teamId: string): Promise<UserRow[]> {
    const db = this.prisma.forTenant(user.tenantId);
    const team = await db.team.findFirst({
      where: { id: teamId, deletedAt: null },
      select: { id: true },
    });
    if (!team) throw codedNotFound('TEAM_NOT_FOUND', 'Team not found.');

    const rows = await db.user.findMany({
      where: { teamId, deletedAt: null },
      include: { role: true, manager: true, team: true },
      orderBy: { name: 'asc' },
    });

    return rows.map((u) => ({
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
    }));
  }

  /**
   * Assign users to a team in bulk.
   *
   * Idempotent — re-adding an existing member is a no-op, so a double-clicked
   * button does not produce an error. All-or-nothing on validity: if any id is
   * unknown or belongs to another tenant, the WHOLE batch is refused rather
   * than half-applied, because a partial assignment is harder to notice and
   * harder to undo than an outright failure.
   */
  async addMembers(
    user: RequestUser,
    teamId: string,
    body: TeamMembers,
  ): Promise<{ added: number }> {
    return this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      const team = await tx.team.findFirst({
        where: { id: teamId, deletedAt: null },
        select: { id: true },
      });
      if (!team) throw codedNotFound('TEAM_NOT_FOUND', 'Team not found.');

      const unique = [...new Set(body.userIds)];
      const found = await tx.user.findMany({
        where: { id: { in: unique }, deletedAt: null },
        select: { id: true, teamId: true },
      });
      if (found.length !== unique.length) {
        throw codedBadRequest(
          'INVALID_REFERENCE',
          'One or more of those users does not exist in this workspace.',
        );
      }

      const toAdd = found.filter((u) => u.teamId !== teamId).map((u) => u.id);
      if (toAdd.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: toAdd } },
          data: { teamId },
        });
        await this.audit(tx, user, 'team.members_added', teamId, null, {
          userIds: toAdd,
        });
      }
      return { added: toAdd.length };
    });
  }

  /**
   * Remove one member. Removing a non-member is a no-op rather than an error:
   * the caller's intent — "this person should not be on this team" — is
   * already satisfied.
   */
  async removeMember(
    user: RequestUser,
    teamId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      const team = await tx.team.findFirst({
        where: { id: teamId, deletedAt: null },
        select: { id: true },
      });
      if (!team) throw codedNotFound('TEAM_NOT_FOUND', 'Team not found.');

      const result = await tx.user.updateMany({
        where: { id: userId, teamId },
        data: { teamId: null },
      });
      if (result.count > 0) {
        await this.audit(tx, user, 'team.member_removed', teamId, null, {
          userId,
        });
      }
    });
  }

  // ------------------------------------------------------------------ internals

  /**
   * A team's manager must be a live, active user in this tenant.
   *
   * `Team.managerId` is a required foreign key, so without this an invalid id
   * surfaces as a Prisma P2003 and a 500 — telling the caller nothing about
   * which field they got wrong.
   */
  private async assertManagerUsable(
    db: { user: { findFirst: (a: unknown) => Promise<unknown> } },
    managerId: string,
  ): Promise<void> {
    const manager = await db.user.findFirst({
      where: { id: managerId, deletedAt: null, active: true },
      select: { id: true },
    });
    if (!manager) {
      throw codedBadRequest(
        'INVALID_MANAGER',
        'That manager is not available: they must be an active user in this workspace.',
      );
    }
  }

  private async audit(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    action:
      | 'team.created'
      | 'team.updated'
      | 'team.deleted'
      | 'team.members_added'
      | 'team.member_removed',
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action,
        entity: 'Team',
        entityId,
        before: (before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (after ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
