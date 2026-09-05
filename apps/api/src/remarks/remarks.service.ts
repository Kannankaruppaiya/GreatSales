import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  EntityTypeValue,
  PermissionKey,
  RemarkCreate,
  RemarkListQuery,
  RemarkRow,
  RequestUser,
} from '@greatsales/shared';
import { CursorPage } from '@greatsales/shared';
import { PrismaService, type TenantPrisma } from '../prisma/prisma.service';

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

/**
 * A remark inherits the authorization of the record it is attached to.
 *
 * There is no `remark.read` / `remark.write` key on purpose: a note about a
 * payment is payment data, and inventing a separate key would let a role read
 * the commentary on records it cannot open. Reads require the parent's read
 * permission, writes the parent's write permission.
 */
const PARENT_PERMISSION: Record<
  EntityTypeValue,
  { read: PermissionKey; write: PermissionKey }
> = {
  Projection: { read: 'projection.read', write: 'projection.write' },
  Lead: { read: 'lead.read', write: 'lead.write' },
  Payment: { read: 'payment.read', write: 'payment.write' },
  Order: { read: 'order.read', write: 'order.write' },
  Customer: { read: 'customer.read', write: 'customer.write' },
};

@Injectable()
export class RemarksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: RequestUser,
    query: RemarkListQuery,
  ): Promise<CursorPage<RemarkRow>> {
    const db = this.prisma.forTenant(user.tenantId);
    await this.assertPermission(db, user, query.entityType, 'read');
    await this.assertParentVisible(db, user, query.entityType, query.entityId);

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
    await this.assertPermission(db, user, body.entityType, 'write');
    await this.assertParentVisible(db, user, body.entityType, body.entityId);

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

  /**
   * The caller's role must hold the parent entity's permission.
   *
   * PermissionsGuard cannot do this: the required key depends on the
   * `entityType` in the request body, which the guard does not read.
   */
  private async assertPermission(
    db: TenantPrisma,
    user: RequestUser,
    entityType: EntityTypeValue,
    action: 'read' | 'write',
  ): Promise<void> {
    const needed = PARENT_PERMISSION[entityType][action];
    const held = await db.rolePermission.findFirst({
      where: {
        roleId: user.roleId,
        permission: { key: needed },
      },
      select: { permissionId: true },
    });
    if (!held) {
      throw new ForbiddenException(
        `Requires ${needed} to ${action} remarks on a ${entityType}`,
      );
    }
  }

  /**
   * The parent row must exist and be reachable by this caller.
   *
   * RLS already bounds the lookup to the tenant, so this closes the remaining
   * gap: a sales user must not read or annotate another rep's records, and an
   * id for a row that does not exist must 403 rather than create an orphan
   * remark that no screen will ever show.
   */
  private async assertParentVisible(
    db: TenantPrisma,
    user: RequestUser,
    entityType: EntityTypeValue,
    entityId: string,
  ): Promise<void> {
    const ownerId = (await this.isSalesOnly(db, user.roleId))
      ? user.userId
      : undefined;
    const owned = ownerId ? { salespersonId: ownerId } : {};

    const found = await (async () => {
      switch (entityType) {
        case 'Customer':
          return db.customer.findFirst({
            where: { id: entityId, deletedAt: null, ...owned },
            select: { id: true },
          });
        case 'Lead':
          return db.lead.findFirst({
            where: { id: entityId, deletedAt: null, ...owned },
            select: { id: true },
          });
        case 'Order':
          return db.salesOrder.findFirst({
            where: { id: entityId, deletedAt: null, ...owned },
            select: { id: true },
          });
        case 'Payment':
          return db.payment.findFirst({
            where: { id: entityId, deletedAt: null, ...owned },
            select: { id: true },
          });
        case 'Projection':
          return db.projection.findFirst({
            where: {
              id: entityId,
              deletedAt: null,
              ...(ownerId
                ? { mapping: { salespersonId: ownerId } }
                : {}),
            },
            select: { id: true },
          });
      }
    })();

    if (!found) {
      throw new ForbiddenException(
        `No ${entityType} you can reach with id ${entityId}`,
      );
    }
  }

  /** True when the caller's role can only ever act on its own records. */
  private async isSalesOnly(
    db: TenantPrisma,
    roleId: string,
  ): Promise<boolean> {
    const role = await db.role.findUnique({ where: { id: roleId } });
    return role?.name === 'sales';
  }
}
