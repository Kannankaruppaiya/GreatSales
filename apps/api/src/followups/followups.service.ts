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

/** Prisma include graph that carries everything a {@link FollowUpRow} needs. */
const FOLLOWUP_INCLUDE = { salesperson: true } satisfies Prisma.FollowUpInclude;

type FollowUpWithGraph = Prisma.FollowUpGetPayload<{
  include: typeof FOLLOWUP_INCLUDE;
}>;

function toRow(f: FollowUpWithGraph): FollowUpRow {
  return {
    id: f.id,
    entityType: f.entityType,
    entityId: f.entityId,
    salespersonId: f.salespersonId,
    salespersonName: f.salesperson.name,
    title: f.title,
    subtitle: f.subtitle,
    amount: f.amount == null ? null : f.amount.toNumber(),
    dueDate: f.dueDate.toISOString().slice(0, 10),
    done: f.done,
    note: f.note,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
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
      ...(query.done !== undefined ? { done: query.done } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [rows, total] = await db.$transaction([
      db.followUp.findMany({
        where,
        include: FOLLOWUP_INCLUDE,
        orderBy: { id: 'asc' },
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      db.followUp.count({ where }),
    ]);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map(toRow),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      total,
    };
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
    return toRow(created);
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
    return toRow(updated);
  }

  /** Hard delete — the FollowUp table has no soft-delete column. */
  async remove(user: RequestUser, id: string): Promise<void> {
    const db = this.prisma.forTenant(user.tenantId);
    await this.assertOwned(db, user, id);
    await db.followUp.delete({ where: { id } });
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
