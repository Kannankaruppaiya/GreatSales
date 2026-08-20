import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ProjectionLine,
  ProjectionListQuery,
  ProjectionListResponse,
  ProjectionUpdate,
  RequestUser,
} from '@greatsales/shared';
import { PrismaService, type TenantPrisma } from '../prisma/prisma.service';
import {
  applyFilters,
  sortLines,
  summarize,
  toLine,
  type EngineRow,
} from './projection-engine';

/** Prisma include graph that carries everything a {@link ProjectionLine} needs. */
const PROJECTION_INCLUDE = {
  mapping: {
    include: {
      customer: {
        include: { contacts: { where: { isPrimary: true }, take: 1 } },
      },
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
    today: string = new Date().toISOString().slice(0, 10),
  ): Promise<ProjectionListResponse> {
    const db = this.prisma.forTenant(user.tenantId);
    const ownerId = await this.resolveOwnerScope(db, user, query.ownerId);

    const rows = await db.projection.findMany({
      where: {
        period: query.period,
        deletedAt: null,
        ...(ownerId ? { mapping: { salespersonId: ownerId } } : {}),
      },
      include: PROJECTION_INCLUDE,
    });

    const lines = sortLines(
      applyFilters(
        rows.map((r) => toLine(toEngineLine(r))),
        {
          principalId: query.principalId,
          search: query.search,
          lineFilter: query.lineFilter,
          today,
        },
      ),
    );

    return { lines, summary: summarize(lines) };
  }

  /** Inline cell edit. Salespeople may only edit lines they own. */
  async update(
    user: RequestUser,
    id: string,
    patch: ProjectionUpdate,
  ): Promise<ProjectionLine> {
    const db = this.prisma.forTenant(user.tenantId);

    const existing = await db.projection.findFirst({
      where: { id, deletedAt: null },
      include: PROJECTION_INCLUDE,
    });
    if (!existing) throw new NotFoundException('Projection not found');

    const restrictToSelf = await this.isSalesOnly(db, user.roleId);
    if (restrictToSelf && existing.mapping.salespersonId !== user.userId) {
      throw new ForbiddenException('Cannot edit another salesperson line');
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
    return toLine(toEngineLine(updated));
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

  private async isSalesOnly(
    db: TenantPrisma,
    roleId: string,
  ): Promise<boolean> {
    const role = await db.role.findUnique({ where: { id: roleId } });
    return role?.name === 'sales';
  }
}

/** Normalize a Prisma projection row (Decimal/Date) into a pure {@link EngineRow}. */
function toEngineLine(row: ProjectionRow): EngineRow {
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
    customerId: mapping.customer.id,
    customerName: mapping.customer.name,
    contactName: mapping.customer.contacts[0]?.name ?? null,
    tier: mapping.customer.category,
    productId: mapping.product.id,
    productName: mapping.product.name,
    principalId: mapping.product.principal.id,
    principalName: mapping.product.principal.name,
    salespersonId: mapping.salesperson.id,
    salespersonName: mapping.salesperson.name,
  };
}
