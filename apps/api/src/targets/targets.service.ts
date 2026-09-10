import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  RequestUser,
  SalesTargetRow,
  TargetListQuery,
  TargetUpsert,
} from '@greatsales/shared';
import { PrismaService, type TenantPrisma } from '../prisma/prisma.service';

const TARGET_INCLUDE = {
  salesperson: true,
} satisfies Prisma.SalesTargetInclude;

type TargetWithGraph = Prisma.SalesTargetGetPayload<{
  include: typeof TARGET_INCLUDE;
}>;

function toRow(t: TargetWithGraph): SalesTargetRow {
  return {
    id: t.id,
    salespersonId: t.salespersonId,
    salespersonName: t.salesperson.name,
    period: t.period,
    // Decimal -> number once, here. Every money field on this wire is a number
    // (ProjectionLine.projValue, LeadRow.totalValue); a Decimal string leaking
    // out would make the dashboard the only place that has to parse one.
    targetValue: Number(t.targetValue),
  };
}

/**
 * Monthly sales targets, one per salesperson per period.
 *
 * The table has existed since the first migration and nothing outside fixtures
 * ever touched it, which is why the dashboard could show what a month achieved
 * but never what it was supposed to achieve.
 *
 * Scoping matches the dashboard exactly: admin and management see and set
 * everyone's; a sales user reads only their own and cannot set any. That is not
 * only a permission — `target.manage` already stops the write — it is also the
 * read scope, because a target is a private figure between a person and their
 * manager and the team list is not the place to publish it.
 */
@Injectable()
export class TargetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: RequestUser,
    query: TargetListQuery,
  ): Promise<SalesTargetRow[]> {
    const db = this.prisma.forTenant(user.tenantId);
    const salespersonId = await this.resolveOwnerScope(
      db,
      user,
      query.salespersonId,
    );

    const rows = await db.salesTarget.findMany({
      where: {
        ...(query.period ? { period: query.period } : {}),
        ...(salespersonId ? { salespersonId } : {}),
      },
      include: TARGET_INCLUDE,
      // Newest month first, then by person, so a period's rows arrive together
      // in a stable order rather than in insertion order.
      orderBy: [{ period: 'desc' }, { salesperson: { name: 'asc' } }],
    });
    return rows.map(toRow);
  }

  /**
   * The sum of the targets in scope for one period.
   *
   * Null when nobody in scope has a target set — the dashboard renders "no
   * target" and "a target of zero" differently, so this must not flatten the
   * two into 0.
   */
  async totalFor(
    user: RequestUser,
    periods: string[],
    ownerId?: string,
  ): Promise<{ total: number | null; byPerson: Map<string, number> }> {
    const db = this.prisma.forTenant(user.tenantId);
    const salespersonId = await this.resolveOwnerScope(db, user, ownerId);

    const rows = periods.length
      ? await db.salesTarget.findMany({
          where: {
            period: { in: periods },
            ...(salespersonId ? { salespersonId } : {}),
          },
          include: TARGET_INCLUDE,
        })
      : [];

    // Summed across the window's months, because a target is a month and a
    // year-long window covers twelve of them. A person with a target in only
    // some of those months contributes only those.
    const byPerson = new Map<string, number>();
    for (const row of rows) {
      byPerson.set(
        row.salespersonId,
        (byPerson.get(row.salespersonId) ?? 0) + Number(row.targetValue),
      );
    }
    return {
      total: rows.length
        ? [...byPerson.values()].reduce((n, v) => n + v, 0)
        : null,
      byPerson,
    };
  }

  async upsert(
    user: RequestUser,
    body: TargetUpsert,
  ): Promise<SalesTargetRow> {
    const db = this.prisma.forTenant(user.tenantId);

    // The target has to belong to somebody in this tenant. Without this check
    // the unique constraint would happily store a target against an id from
    // another workspace — RLS stops the read, but the row should never exist.
    const person = await db.user.findFirst({
      where: { id: body.salespersonId, deletedAt: null },
    });
    if (!person) {
      throw new BadRequestException(
        'That user is not in this workspace, or has been removed.',
      );
    }

    const saved = await db.salesTarget.upsert({
      where: {
        salespersonId_period: {
          salespersonId: body.salespersonId,
          period: body.period,
        },
      },
      create: {
        tenantId: user.tenantId,
        salespersonId: body.salespersonId,
        period: body.period,
        targetValue: body.targetValue.toFixed(2),
      },
      update: { targetValue: body.targetValue.toFixed(2) },
      include: TARGET_INCLUDE,
    });
    return toRow(saved);
  }

  /**
   * Remove a target.
   *
   * Deleting is how a target is unset; setting it to zero means something else
   * (a real target of nothing, for someone on leave), and the dashboard shows
   * the two differently.
   */
  async remove(user: RequestUser, id: string): Promise<void> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.salesTarget.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('That target no longer exists.');
    await db.salesTarget.delete({ where: { id } });
  }

  /** For admin/mgmt: honor the requested filter. For sales: force self. */
  private async resolveOwnerScope(
    db: TenantPrisma,
    user: RequestUser,
    requested?: string,
  ): Promise<string | undefined> {
    const role = await db.role.findUnique({ where: { id: user.roleId } });
    if (role?.name === 'sales') return user.userId;
    return requested && requested !== 'ALL' ? requested : undefined;
  }
}
