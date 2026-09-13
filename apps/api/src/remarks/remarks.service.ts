import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  RemarkCreate,
  RemarkListQuery,
  RemarkRow,
  RequestUser,
} from '@greatsales/shared';
import { CursorPage } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
/**
 * A remark inherits the authorization of the record it is attached to. Both
 * halves of that rule now live in common/entity-access.ts, because attachments
 * obey exactly the same one and a second copy is how the sales-scope check ends
 * up disagreeing with itself.
 */
import {
  assertEntityPermission,
  assertParentVisible,
} from '../common/entity-access';

const REMARK_INCLUDE = { user: true } satisfies Prisma.RemarkInclude;

type RemarkWithGraph = Prisma.RemarkGetPayload<{
  include: typeof REMARK_INCLUDE;
}>;

function toRow(r: RemarkWithGraph): RemarkRow {
  return {
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    userId: r.userId,
    userName: r.user?.name ?? null,
    text: r.text,
    at: r.at.toISOString(),
  };
}

@Injectable()
export class RemarksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: RequestUser,
    query: RemarkListQuery,
  ): Promise<CursorPage<RemarkRow>> {
    const db = this.prisma.forTenant(user.tenantId);
    await assertEntityPermission(db, user, query.entityType, 'read', 'remarks');
    await assertParentVisible(db, user, query.entityType, query.entityId);

    const where: Prisma.RemarkWhereInput = {
      entityType: query.entityType,
      entityId: query.entityId,
    };

    const [rows, total] = await db.$transaction([
      db.remark.findMany({
        where,
        include: REMARK_INCLUDE,
        // Newest first: a timeline is read from the top.
        orderBy: [{ at: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      db.remark.count({ where }),
    ]);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map(toRow),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      total,
    };
  }

  async create(user: RequestUser, body: RemarkCreate): Promise<RemarkRow> {
    const db = this.prisma.forTenant(user.tenantId);
    await assertEntityPermission(db, user, body.entityType, 'write', 'remarks');
    await assertParentVisible(db, user, body.entityType, body.entityId);

    const created = await db.remark.create({
      data: {
        tenantId: user.tenantId,
        entityType: body.entityType,
        entityId: body.entityId,
        // The author is always the caller. Accepting a userId from the body
        // would let anyone post a note under someone else's name.
        userId: user.userId,
        text: body.text,
      },
      include: REMARK_INCLUDE,
    });
    return toRow(created);
  }
}
