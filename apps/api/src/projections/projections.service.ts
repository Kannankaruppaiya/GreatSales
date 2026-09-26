import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ProjectionLine,
  ProjectionListQuery,
  ProjectionListResponse,
  ProjectionRollForward,
  ProjectionRollForwardResult,
  ProjectionUpdate,
  RequestUser,
} from '@greatsales/shared';
import { PrismaService, type TenantPrisma } from '../prisma/prisma.service';
import { codedForbidden } from '../common/error-codes';
import { PeriodLocksService } from '../period-locks/period-locks.service';
import { businessToday } from '../common/business-day';
import {
  clearRecordFollowUp,
  syncRecordFollowUp,
} from '../followups/record-followup';
import {
  applyFilters,
  sortLines,
  summarize,
  toLine,
  type EngineRow,
} from './projection-engine';

/**
 * Statuses a line does not come back from. A rolled-forward month is next
 * month's intent, and business that was lost or cancelled is not intent.
 */
const ROLL_FORWARD_STOPS = new Set<string>(['Lost', 'Cancelled']);

/** Prisma include graph that carries everything a {@link ProjectionLine} needs. */
const PROJECTION_INCLUDE = {
  mapping: {
    include: {
      customer: true,
      product: { include: { principal: true } },
      salesperson: true,
    },
  },
  salesOrder: true,
} satisfies Prisma.ProjectionInclude;

type ProjectionRow = Prisma.ProjectionGetPayload<{
  include: typeof PROJECTION_INCLUDE;
}>;

function dec(v: Prisma.Decimal | null): number | null {
  return v == null ? null : v.toNumber();
}
function ymd(d: Date | null): string | null {
  return d == null ? null : d.toISOString().slice(0, 10);
}

@Injectable()
export class ProjectionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enriched, filtered, sorted worksheet for one period. RLS scopes to the
   * tenant; salespeople are further scoped to their own mapped lines, while
   * admin/management may filter to a specific salesperson via `ownerId`.
   */
  async list(
    user: RequestUser,
    query: ProjectionListQuery,
    today: string = businessToday(),
  ): Promise<ProjectionListResponse> {
    return this.forPeriods(user, [query.period], query, today);
  }

  /**
   * The same worksheet, over SEVERAL months.
   *
   * The dashboard's window can be a year, and a projection is keyed by month —
   * so twelve months of recurring commitment is twelve periods of rows summed
   * once, not twelve calls to `list` whose summaries are then added up
   * somewhere else. `summarize` stays the only place that arithmetic lives,
   * which is the rule this whole service was written around.
   *
   * `list` is a caller of this with one period, rather than a copy of it.
   */
  async forPeriods(
    user: RequestUser,
    periods: string[],
    filters: Omit<ProjectionListQuery, 'period'>,
    today: string = businessToday(),
  ): Promise<ProjectionListResponse> {
    const db = this.prisma.forTenant(user.tenantId);
    const ownerId = await this.resolveOwnerScope(db, user, filters.ownerId);

    const rows = periods.length
      ? await db.projection.findMany({
          where: {
            period: { in: periods },
            deletedAt: null,
            mapping: {
              ...(ownerId ? { salespersonId: ownerId } : {}),
              ...(filters.customerId ? { customerId: filters.customerId } : {}),
            },
          },
          include: PROJECTION_INCLUDE,
        })
      : [];

    return this.enrich(db, rows, filters, today);
  }

  /**
   * One line, enriched exactly as the worksheet enriches it, or 404 —
   * including a line on another salesperson's mapping.
   */
  async get(
    user: RequestUser,
    id: string,
    today: string = businessToday(),
  ): Promise<ProjectionLine> {
    const db = this.prisma.forTenant(user.tenantId);
    const ownerId = await this.resolveOwnerScope(db, user, undefined);
    const row = await db.projection.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(ownerId ? { mapping: { salespersonId: ownerId } } : {}),
      },
      include: PROJECTION_INCLUDE,
    });
    if (!row) throw new NotFoundException('Projection not found');
    const { lines } = await this.enrich(
      db,
      [row],
      { lineFilter: 'all' },
      today,
    );
    return lines[0];
  }

  /** Contact names, activity counts and the engine's derived figures. */
  private async enrich(
    db: TenantPrisma,
    rows: ProjectionRow[],
    filters: Omit<ProjectionListQuery, 'period'>,
    today: string,
  ): Promise<ProjectionListResponse> {
    const ids = rows.map((r) => r.id);
    const [contactNames, remarkCounts, followUpCounts] = await Promise.all([
      this.primaryContactNames(
        db,
        rows.map((r) => r.mapping.customer.id),
      ),
      this.activityCounts(db, 'remark', ids),
      this.activityCounts(db, 'followUp', ids),
    ]);
    const lines = sortLines(
      applyFilters(
        rows.map((r) =>
          toLine(toEngineLine(r, contactNames, remarkCounts, followUpCounts)),
        ),
        {
          principalId: filters.principalId,
          search: filters.search,
          lineFilter: filters.lineFilter,
          today,
        },
      ),
    );

    return { lines, summary: summarize(lines) };
  }

  /**
   * Inline cell edit. Salespeople may only edit lines they own.
   *
   * The lock check and the write run inside ONE `transactionForTenant` call,
   * not two separate round trips — `forTenant` gives every model operation
   * its own transaction, so a plain check-then-write here would leave a
   * window where a period gets locked between the read and the update and
   * the edit goes through anyway. Postgres's read-committed default still
   * lets a lock created in another transaction after this one starts be
   * seen by the `isLocked` read partway through — running both statements on
   * the same connection is what makes them one unit of work.
   */
  async update(
    user: RequestUser,
    id: string,
    patch: ProjectionUpdate,
  ): Promise<ProjectionLine> {
    return this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      // Same runtime client as `forTenant` returns, just already inside this
      // transaction rather than one of its own — the cast only tells
      // TypeScript to treat it as the shape the private helpers below expect.
      const db = tx as unknown as TenantPrisma;

      const existing = await db.projection.findFirst({
        where: { id, deletedAt: null },
        include: PROJECTION_INCLUDE,
      });
      if (!existing) throw new NotFoundException('Projection not found');

      const restrictToSelf = await this.isSalesOnly(db, user.roleId);
      if (restrictToSelf && existing.mapping.salespersonId !== user.userId) {
        throw new ForbiddenException('Cannot edit another salesperson line');
      }

      // A closed month is frozen for everyone, including admins. This is the
      // ONLY enforcement of the Data page's period lock: that toggle used to
      // be local React state, so the card promised the figures were frozen
      // while every row stayed editable. Checked against the row's own
      // period rather than any period the client sends, so a client cannot
      // pick an unlocked month.
      if (await PeriodLocksService.isLocked(db, existing.period)) {
        throw codedForbidden(
          'PERIOD_LOCKED',
          `${existing.period} is locked for reporting and cannot be edited`,
        );
      }

      const data: Prisma.ProjectionUpdateInput = {};
      if ('price' in patch) data.price = patch.price ?? null;
      if (patch.committedQty !== undefined)
        data.committedQty = patch.committedQty;
      if (patch.achievedQty !== undefined) data.achievedQty = patch.achievedQty;
      if (patch.status !== undefined) data.status = patch.status;
      if ('probability' in patch) data.probability = patch.probability ?? null;
      if ('nextFollowUp' in patch) {
        data.nextFollowUp = patch.nextFollowUp
          ? new Date(patch.nextFollowUp)
          : null;
      }
      if ('targetDate' in patch) {
        data.targetDate = patch.targetDate ? new Date(patch.targetDate) : null;
      }

      const updated = await db.projection.update({
        where: { id },
        data,
        include: PROJECTION_INCLUDE,
      });

      // The worksheet's "Log follow-up" button lands here. Writing only the
      // date column left the Follow-ups page, the dashboard tile and the
      // mobile screen — all of which list `FollowUp` rows — with no idea the
      // follow-up existed. Mirrored inside this transaction so the two can
      // never disagree, and only under this branch so a price edit cannot
      // reopen a task that was already ticked off.
      //
      // Built from the wire line rather than the raw row so the task's amount
      // is the worksheet's own `projValue`, priced by the same engine instead
      // of by a second copy of the price-precedence rule.
      const line = toLine(
        toEngineLine(
          updated,
          await this.primaryContactNames(db, [updated.mapping.customer.id]),
          await this.activityCounts(db, 'remark', [updated.id]),
          await this.activityCounts(db, 'followUp', [updated.id]),
        ),
      );

      if ('nextFollowUp' in patch) {
        await syncRecordFollowUp(db, user.tenantId, {
          entityType: 'Projection',
          entityId: updated.id,
          salespersonId: line.salespersonId,
          dueDate: updated.nextFollowUp,
          title: `Follow up — ${line.customerName}`,
          subtitle: `${line.productName} · ${line.principalName} · ${line.period}`,
          amount: line.projValue,
        });
        // The badge counts FollowUp rows, so it is one higher (or lower) than
        // the count read a few lines above.
        line.followUpCount =
          (await this.activityCounts(db, 'followUp', [updated.id])).get(
            updated.id,
          ) ?? 0;
      }

      return line;
    });
  }

  /**
   * Open a month by carrying the previous month's commitments into it.
   *
   * The rules, and the reason for each, are on `ProjectionRollForwardSchema`.
   * Two of them matter enough to restate here: nothing is ever overwritten —
   * a mapping that already has a row in the target month is skipped, so this is
   * safe to run twice — and the target month's lock is checked before anything
   * is written, because a locked month is frozen for everyone including the
   * administrator who just pressed the button.
   */
  async rollForward(
    user: RequestUser,
    body: ProjectionRollForward,
  ): Promise<ProjectionRollForwardResult> {
    return this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      const db = tx as unknown as TenantPrisma;
      const ownerId = await this.resolveOwnerScope(db, user, body.ownerId);

      if (await PeriodLocksService.isLocked(db, body.to)) {
        throw codedForbidden(
          'PERIOD_LOCKED',
          `${body.to} is locked for reporting and cannot be edited`,
        );
      }

      const scope = ownerId ? { mapping: { salespersonId: ownerId } } : {};

      // The month to copy from: whatever the caller named, or the most recent one
      // before the target that actually has lines — which is what "the month
      // before" means on a worksheet that can have gaps in it.
      const from =
        body.from ??
        (
          await db.projection.findFirst({
            where: { period: { lt: body.to }, deletedAt: null, ...scope },
            orderBy: { period: 'desc' },
            select: { period: true },
          })
        )?.period;

      if (!from) {
        throw new BadRequestException(
          `No earlier month with projections to roll forward into ${body.to}`,
        );
      }
      if (from >= body.to) {
        throw new BadRequestException(
          `Cannot roll ${from} forward into ${body.to} — it is not an earlier month`,
        );
      }

      const source = await db.projection.findMany({
        where: { period: from, deletedAt: null, ...scope },
        include: { mapping: true },
      });

      // Every row already in the target month. `(mappingId, period)` is unique,
      // so this is what keeps a second roll from colliding rather than skipping —
      // and it is read without a `deletedAt` filter on purpose, so that if a
      // tombstone ever does hold a slot the roll steps over it instead of failing.
      const taken = new Set(
        (
          await db.projection.findMany({
            where: { period: body.to },
            select: { mappingId: true },
          })
        ).map((r) => r.mappingId),
      );

      const carry = source.filter(
        (r) =>
          Number(r.committedQty) > 0 &&
          !ROLL_FORWARD_STOPS.has(r.status) &&
          !taken.has(r.mappingId),
      );

      if (carry.length > 0) {
        await db.projection.createMany({
          data: carry.map((r) => ({
            tenantId: user.tenantId,
            mappingId: r.mappingId,
            period: body.to,
            committedQty: r.committedQty,
            achievedQty: 0,
            // The mapping's own price when it carries one, so a repriced mapping
            // opens the new month at today's price rather than last month's.
            price: r.mapping.customPrice ?? r.price,
            status: 'ProjectionCreated' as const,
          })),
        });
      }

      return {
        from,
        to: body.to,
        created: carry.length,
        skipped: source.length - carry.length,
      };
    });
  }

  /**
   * Drop a line from a month.
   *
   * The counterpart to rolling one forward: a roll carries every commitment the
   * previous month held, and some are for customers who have since stopped
   * buying — a worksheet that can only gain lines leaves those in the total,
   * and the only way out would be to commit zero and pretend.
   *
   * The row goes, rather than being tombstoned. `(mappingId, period)` is
   * unique, so a soft-deleted line would hold its slot for good: that customer
   * and product could never be put back into that month by any means, and a
   * mistaken click would be permanent. What was committed and by whom is the
   * audit log's job, not a dead row's.
   *
   * A line that has already produced a sales order is refused instead — that is
   * no longer a plan, it is an order somebody is fulfilling.
   *
   * Guarded exactly like an edit: same ownership rule, same period lock.
   */
  async remove(user: RequestUser, id: string): Promise<void> {
    await this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      const db = tx as unknown as TenantPrisma;
      const existing = await db.projection.findFirst({
        where: { id, deletedAt: null },
        include: { mapping: true, salesOrder: { select: { status: true } } },
      });
      if (!existing) throw new NotFoundException('Projection not found');

      if (await this.isSalesOnly(db, user.roleId)) {
        if (existing.mapping.salespersonId !== user.userId) {
          throw new ForbiddenException(
            'Cannot delete another salesperson line',
          );
        }
      }

      if (await PeriodLocksService.isLocked(db, existing.period)) {
        throw codedForbidden(
          'PERIOD_LOCKED',
          `${existing.period} is locked for reporting and cannot be edited`,
        );
      }

      // A cancelled order is not an order. Reading the raw pointer left a line
      // permanently undeletable after its order was cancelled — while the same
      // worksheet was offering to raise a new one, because the wire already
      // reports a cancelled link as no link.
      if (
        existing.salesOrderId &&
        existing.salesOrder?.status !== 'Cancelled'
      ) {
        throw new ConflictException(
          'This line has been converted to a sales order and cannot be removed',
        );
      }

      await db.projection.delete({ where: { id } });
      // A line that is gone must not leave its follow-up on somebody's list.
      await clearRecordFollowUp(db, 'Projection', id);
    });
  }

  /** For admin/mgmt: honor the requested ownerId filter. For sales: force self. */
  private async resolveOwnerScope(
    db: TenantPrisma,
    user: RequestUser,
    requestedOwnerId?: string,
  ): Promise<string | undefined> {
    if (await this.isSalesOnly(db, user.roleId)) return user.userId;
    return requestedOwnerId && requestedOwnerId !== 'ALL'
      ? requestedOwnerId
      : undefined;
  }

  /**
   * projectionId → how many remarks / follow-ups it carries.
   *
   * `Remark` and `FollowUp` are both polymorphic on (entityType, entityId), so
   * there is no relation to include — one grouped query per page beats a join
   * that cannot exist, and beats N queries even more.
   */
  private async activityCounts(
    db: TenantPrisma,
    table: 'remark' | 'followUp',
    projectionIds: string[],
  ): Promise<Map<string, number>> {
    if (projectionIds.length === 0) return new Map();
    const rows = await (table === 'remark'
      ? db.remark.groupBy({
          by: ['entityId'],
          where: { entityType: 'Projection', entityId: { in: projectionIds } },
          _count: { _all: true },
        })
      : db.followUp.groupBy({
          by: ['entityId'],
          where: { entityType: 'Projection', entityId: { in: projectionIds } },
          _count: { _all: true },
        }));
    return new Map(rows.map((r) => [r.entityId, r._count._all]));
  }

  /** customerId → primary contact name, for a page of lines, in one query. */
  private async primaryContactNames(
    db: TenantPrisma,
    customerIds: string[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(customerIds)];
    if (unique.length === 0) return new Map();
    const rows = await db.contact.findMany({
      where: {
        entityType: 'Customer',
        entityId: { in: unique },
        isPrimary: true,
      },
      select: { entityId: true, name: true },
    });
    return new Map(rows.map((r) => [r.entityId, r.name]));
  }

  private async isSalesOnly(
    db: TenantPrisma,
    roleId: string,
  ): Promise<boolean> {
    const role = await db.role.findUnique({ where: { id: roleId } });
    return role?.name === 'sales';
  }
}

/** Normalize a Prisma projection row (Decimal/Date) into a pure {@link EngineRow}. */
/**
 * @param contactNames customerId → the primary contact's name.
 *
 * Passed in rather than reached through an include: `Contact` is polymorphic
 * (see the 20260912100000 migration), so it has no relation to traverse and one
 * batched lookup per page beats a join that cannot exist.
 */
function toEngineLine(
  row: ProjectionRow,
  contactNames: Map<string, string>,
  remarkCounts: Map<string, number>,
  followUpCounts: Map<string, number>,
): EngineRow {
  const { mapping, salesOrder } = row;
  const activeOrder =
    salesOrder && salesOrder.status !== 'Cancelled' ? salesOrder : null;
  return {
    id: row.id,
    period: row.period,
    projectionPrice: dec(row.price),
    customPrice: dec(mapping.customPrice),
    basePrice: dec(mapping.product.basePrice),
    committedQty: dec(row.committedQty) ?? 0,
    achievedQty: dec(row.achievedQty) ?? 0,
    probability: row.probability,
    status: row.status,
    nextFollowUp: ymd(row.nextFollowUp),
    targetDate: ymd(row.targetDate),
    salesOrderId: activeOrder?.id ?? null,
    salesOrderStatus: activeOrder?.status ?? null,
    remarkCount: remarkCounts.get(row.id) ?? 0,
    followUpCount: followUpCounts.get(row.id) ?? 0,
    customerId: mapping.customer.id,
    customerName: mapping.customer.name,
    contactName: contactNames.get(mapping.customer.id) ?? null,
    tier: mapping.customer.category,
    productId: mapping.product.id,
    productName: mapping.product.name,
    principalId: mapping.product.principal.id,
    principalName: mapping.product.principal.name,
    salespersonId: mapping.salesperson.id,
    salespersonName: mapping.salesperson.name,
  };
}
