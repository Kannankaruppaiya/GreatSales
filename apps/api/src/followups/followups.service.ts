import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  FollowUpCreate,
  FollowUpListQuery,
  FollowUpListResponse,
  FollowUpRow,
  FollowUpUpdate,
  RequestUser,
} from '@greatsales/shared';
import { PrismaService, type TenantPrisma } from '../prisma/prisma.service';
import {
  recordBehindFollowUpId,
  type RecordFollowUpEntity,
} from './record-followup';

/** Prisma include graph that carries everything a {@link FollowUpRow} needs. */
const FOLLOWUP_INCLUDE = { salesperson: true } satisfies Prisma.FollowUpInclude;

type FollowUpWithGraph = Prisma.FollowUpGetPayload<{
  include: typeof FOLLOWUP_INCLUDE;
}>;

function toRow(f: FollowUpWithGraph, entityName: string | null): FollowUpRow {
  return {
    id: f.id,
    entityType: f.entityType,
    entityId: f.entityId,
    salespersonId: f.salespersonId,
    salespersonName: f.salesperson.name,
    title: f.title,
    subtitle: f.subtitle,
    entityName,
    amount: f.amount == null ? null : f.amount.toNumber(),
    dueDate: f.dueDate.toISOString().slice(0, 10),
    done: f.done,
    note: f.note,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

type EntityRef = Pick<FollowUpWithGraph, 'entityType' | 'entityId'>;

/**
 * Resolve what each follow-up is about, one query per entity type present.
 *
 * A follow-up points at its record by (type, id) with no foreign key, so the
 * name cannot be joined. Grouping by type keeps this at most five queries for
 * a page of any size, rather than one per row.
 */
async function entityNames(
  db: TenantPrisma,
  refs: EntityRef[],
): Promise<Map<string, string>> {
  const ids = (type: EntityRef['entityType']) => [
    ...new Set(
      refs.filter((r) => r.entityType === type).map((r) => r.entityId),
    ),
  ];
  const key = (type: string, id: string) => `${type}:${id}`;
  const out = new Map<string, string>();
  const put = (type: string, rows: { id: string; name: string | null }[]) => {
    for (const r of rows) if (r.name) out.set(key(type, r.id), r.name);
  };

  const [customers, leads, orders, payments, projections] = await Promise.all([
    ids('Customer').length
      ? db.customer.findMany({
          where: { id: { in: ids('Customer') } },
          select: { id: true, name: true },
        })
      : [],
    ids('Lead').length
      ? db.lead.findMany({
          where: { id: { in: ids('Lead') } },
          select: { id: true, customerName: true },
        })
      : [],
    ids('Order').length
      ? db.salesOrder.findMany({
          where: { id: { in: ids('Order') } },
          select: {
            id: true,
            code: true,
            customer: { select: { name: true } },
          },
        })
      : [],
    ids('Payment').length
      ? db.payment.findMany({
          where: { id: { in: ids('Payment') } },
          select: {
            id: true,
            customerName: true,
            customer: { select: { name: true } },
          },
        })
      : [],
    ids('Projection').length
      ? db.projection.findMany({
          where: { id: { in: ids('Projection') } },
          select: {
            id: true,
            mapping: { select: { customer: { select: { name: true } } } },
          },
        })
      : [],
  ]);
  put('Customer', customers);
  put(
    'Lead',
    leads.map((l) => ({ id: l.id, name: l.customerName })),
  );
  put(
    'Order',
    orders.map((o) => ({
      id: o.id,
      name: o.customer ? `${o.code} · ${o.customer.name}` : o.code,
    })),
  );
  put(
    'Payment',
    payments.map((p) => ({
      id: p.id,
      name: p.customer?.name ?? p.customerName,
    })),
  );
  put(
    'Projection',
    projections.map((p) => ({ id: p.id, name: p.mapping.customer.name })),
  );
  return out;
}

async function toRows(
  db: TenantPrisma,
  rows: FollowUpWithGraph[],
): Promise<FollowUpRow[]> {
  const names = await entityNames(db, rows);
  return rows.map((f) =>
    toRow(f, names.get(`${f.entityType}:${f.entityId}`) ?? null),
  );
}

@Injectable()
export class FollowUpsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tenant-scoped (RLS) follow-up list, cursor-paginated, role-scoped for sales. */
  async list(
    user: RequestUser,
    query: FollowUpListQuery,
  ): Promise<FollowUpListResponse> {
    const db = this.prisma.forTenant(user.tenantId);
    const ownerId = await this.resolveOwnerScope(db, user, query.ownerId);

    const where: Prisma.FollowUpWhereInput = {
      ...(ownerId ? { salespersonId: ownerId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      // Only applied alongside entityType — an id alone could collide across
      // entity types (a Lead and a Payment can share a cuid by coincidence).
      ...(query.entityType && query.entityId
        ? { entityId: query.entityId }
        : {}),
      ...(query.done !== undefined ? { done: query.done } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { subtitle: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            dueDate: {
              ...(query.dueFrom
                ? { gte: new Date(`${query.dueFrom}T00:00:00.000Z`) }
                : {}),
              ...(query.dueTo
                ? { lte: new Date(`${query.dueTo}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {}),
    };

    // Ends in `id` so the cursor always has a total order to resume from.
    const orderBy: Prisma.FollowUpOrderByWithRelationInput[] =
      query.sort === 'due'
        ? [{ dueDate: 'asc' }, { id: 'asc' }]
        : query.sort === '-due'
          ? [{ dueDate: 'desc' }, { id: 'asc' }]
          : [{ id: 'asc' }];

    const [rows, total] = await db.$transaction([
      db.followUp.findMany({
        where,
        include: FOLLOWUP_INCLUDE,
        orderBy,
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      db.followUp.count({ where }),
    ]);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: await toRows(db, page),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      total,
    };
  }

  /**
   * Every task still owed on or before `today`, for the dashboard's card.
   *
   * Uncapped and unpaginated on purpose: it feeds a count, and a count that
   * stopped at a page size would be a different number from the truth. Rows
   * are narrow and only the outstanding ones are selected, so the set is the
   * size of somebody's actual to-do list.
   */
  async outstanding(
    user: RequestUser,
    ownerId: string | undefined,
    today: string,
  ): Promise<FollowUpRow[]> {
    const db = this.prisma.forTenant(user.tenantId);
    const scoped = await this.resolveOwnerScope(db, user, ownerId);
    const rows = await db.followUp.findMany({
      where: {
        done: false,
        dueDate: { lte: new Date(`${today}T23:59:59.999Z`) },
        ...(scoped ? { salespersonId: scoped } : {}),
      },
      include: FOLLOWUP_INCLUDE,
      orderBy: { dueDate: 'asc' },
    });
    return toRows(db, rows);
  }

  /** One follow-up, or 404 — including one owned by another salesperson. */
  async get(user: RequestUser, id: string): Promise<FollowUpRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const ownerId = await this.resolveOwnerScope(db, user);
    const row = await db.followUp.findFirst({
      where: { id, ...(ownerId ? { salespersonId: ownerId } : {}) },
      include: FOLLOWUP_INCLUDE,
    });
    if (!row) throw new NotFoundException('Follow-up not found');
    const [out] = await toRows(db, [row]);
    return out;
  }

  /** Create a follow-up. Sales-only callers always own what they create. */
  async create(user: RequestUser, body: FollowUpCreate): Promise<FollowUpRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const salespersonId = (await this.isSalesOnly(db, user.roleId))
      ? user.userId
      : (body.salespersonId ?? user.userId);

    const created = await db.followUp.create({
      data: {
        tenant: { connect: { id: user.tenantId } },
        salesperson: { connect: { id: salespersonId } },
        entityType: body.entityType,
        entityId: body.entityId,
        dueDate: new Date(body.dueDate),
        title: body.title ?? null,
        subtitle: body.subtitle ?? null,
        amount: body.amount ?? null,
        note: body.note ?? null,
        ...(body.done !== undefined ? { done: body.done } : {}),
      },
      include: FOLLOWUP_INCLUDE,
    });
    const [row] = await toRows(db, [created]);
    return row;
  }

  /** Partial edit (commonly to mark done). Sales may only edit their own. */
  async update(
    user: RequestUser,
    id: string,
    patch: FollowUpUpdate,
  ): Promise<FollowUpRow> {
    const db = this.prisma.forTenant(user.tenantId);
    await this.assertOwned(db, user, id);

    const data: Prisma.FollowUpUpdateInput = {};
    if (patch.entityType !== undefined) data.entityType = patch.entityType;
    if (patch.entityId !== undefined) data.entityId = patch.entityId;
    if (patch.dueDate !== undefined) data.dueDate = new Date(patch.dueDate);
    if ('title' in patch) data.title = patch.title ?? null;
    if ('subtitle' in patch) data.subtitle = patch.subtitle ?? null;
    if ('amount' in patch) data.amount = patch.amount ?? null;
    if ('note' in patch) data.note = patch.note ?? null;
    if (patch.done !== undefined) data.done = patch.done;

    const updated = await db.followUp.update({
      where: { id },
      data,
      include: FOLLOWUP_INCLUDE,
    });

    // The other half of the mirror. A task that IS a projection's or lead's
    // `nextFollowUp` column has to write back, or ticking it off here would
    // leave the worksheet still showing the date — and still counting the line
    // under "Needs follow-up" — for something already done.
    if (patch.done !== undefined || patch.dueDate !== undefined) {
      await this.writeBackToRecord(
        db,
        id,
        updated.done ? null : updated.dueDate,
      );
    }

    const [row] = await toRows(db, [updated]);
    return row;
  }

  /** Hard delete — the FollowUp table has no soft-delete column. */
  async remove(user: RequestUser, id: string): Promise<void> {
    const db = this.prisma.forTenant(user.tenantId);
    await this.assertOwned(db, user, id);
    await db.followUp.delete({ where: { id } });
    await this.writeBackToRecord(db, id, null);
  }

  /**
   * Push a mirrored task's date back onto the record that owns it; a no-op for
   * an ordinary follow-up, which points at a record without being one of its
   * fields.
   *
   * The period lock is deliberately NOT consulted. It freezes a month's
   * figures, and a follow-up date is not a figure — refusing the write would
   * only mean the worksheet and the Follow-ups page disagreed about a task the
   * salesperson had already completed.
   */
  private async writeBackToRecord(
    db: TenantPrisma,
    followUpId: string,
    dueDate: Date | null,
  ): Promise<void> {
    const record = recordBehindFollowUpId(followUpId);
    if (!record) return;

    const table: Record<RecordFollowUpEntity, () => Promise<unknown>> = {
      Projection: () =>
        db.projection.updateMany({
          where: { id: record.entityId },
          data: { nextFollowUp: dueDate },
        }),
      Lead: () =>
        db.lead.updateMany({
          where: { id: record.entityId },
          data: { nextFollowUp: dueDate },
        }),
    };
    await table[record.entityType]();
  }

  private async assertOwned(
    db: TenantPrisma,
    user: RequestUser,
    id: string,
  ): Promise<void> {
    const existing = await db.followUp.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Follow-up not found');
    if (
      (await this.isSalesOnly(db, user.roleId)) &&
      existing.salespersonId !== user.userId
    ) {
      throw new ForbiddenException(
        'Cannot modify another salesperson follow-up',
      );
    }
  }

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

  private async isSalesOnly(
    db: TenantPrisma,
    roleId: string,
  ): Promise<boolean> {
    const role = await db.role.findUnique({ where: { id: roleId } });
    return role?.name === 'sales';
  }
}
