import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  OrderCreate,
  OrderListQuery,
  OrderListResponse,
  OrderRow,
  OrderUpdate,
  RequestUser,
} from '@greatsales/shared';
import { PrismaService, type TenantPrisma } from '../prisma/prisma.service';
import { computeTotal, lineTotal } from './order-engine';

/** Prisma include graph that carries everything an {@link OrderRow} needs. */
const ORDER_INCLUDE = {
  customer: true,
  salesperson: true,
  items: { include: { product: true } },
  statusHistory: {
    include: { changedBy: true },
    orderBy: { at: 'asc' as const },
  },
} satisfies Prisma.SalesOrderInclude;

type OrderWithGraph = Prisma.SalesOrderGetPayload<{
  include: typeof ORDER_INCLUDE;
}>;

function dec(v: Prisma.Decimal | null): number | null {
  return v == null ? null : v.toNumber();
}
function ymd(d: Date | null): string | null {
  return d == null ? null : d.toISOString().slice(0, 10);
}

function toRow(o: OrderWithGraph): OrderRow {
  return {
    id: o.id,
    code: o.code,
    customerId: o.customerId,
    customerName: o.customer.name,
    salespersonId: o.salespersonId,
    salespersonName: o.salesperson.name,
    createdById: o.createdById,
    date: o.date.toISOString(),
    status: o.status,
    total: dec(o.total) ?? 0,
    isUrgent: o.isUrgent,
    paymentTerms: o.paymentTerms,
    advanceAmount: dec(o.advanceAmount),
    advanceRef: o.advanceRef,
    deliveryMode: o.deliveryMode,
    deliveryAddress: o.deliveryAddress,
    expectedDelivery: ymd(o.expectedDelivery),
    transporterName: o.transporterName,
    lrNumber: o.lrNumber,
    deliveryInstructions: o.deliveryInstructions,
    cancelReason: o.cancelReason,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    items: o.items.map((i) => {
      const qty = i.qty.toNumber();
      const price = i.price.toNumber();
      return {
        id: i.id,
        productId: i.productId,
        productName: i.product.name,
        qty,
        price,
        unit: i.unit,
        lineTotal: lineTotal({ qty, price }),
      };
    }),
    statusHistory: o.statusHistory.map((h) => ({
      id: h.id,
      status: h.status,
      note: h.note,
      changedById: h.changedById,
      changedByName: h.changedBy.name,
      at: h.at.toISOString(),
    })),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tenant-scoped (RLS) order list, cursor-paginated, role-scoped for sales. */
  async list(
    user: RequestUser,
    query: OrderListQuery,
  ): Promise<OrderListResponse> {
    const db = this.prisma.forTenant(user.tenantId);
    const ownerId = await this.resolveOwnerScope(db, user, query.ownerId);

    const rows = await db.salesOrder.findMany({
      where: {
        deletedAt: null,
        ...(ownerId ? { salespersonId: ownerId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.search
          ? { code: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      include: ORDER_INCLUDE,
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map(toRow),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /**
   * Create an order with its line items. `total` is computed server-side from
   * the items (never trusted from the client), and an initial status-history
   * entry is recorded. Salespeople always own what they create.
   */
  async create(user: RequestUser, body: OrderCreate): Promise<OrderRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const salespersonId = (await this.isSalesOnly(db, user.roleId))
      ? user.userId
      : body.salespersonId;
    const status = body.status ?? 'Created';
    const total = computeTotal(body.items);

    const created = await db.salesOrder.create({
      data: {
        tenant: { connect: { id: user.tenantId } },
        code: body.code,
        customer: { connect: { id: body.customerId } },
        salesperson: { connect: { id: salespersonId } },
        createdBy: { connect: { id: user.userId } },
        status,
        total,
        ...(body.date ? { date: new Date(body.date) } : {}),
        ...(body.isUrgent !== undefined ? { isUrgent: body.isUrgent } : {}),
        paymentTerms: body.paymentTerms ?? null,
        advanceAmount: body.advanceAmount ?? null,
        advanceRef: body.advanceRef ?? null,
        deliveryMode: body.deliveryMode ?? null,
        deliveryAddress: body.deliveryAddress ?? null,
        expectedDelivery: body.expectedDelivery
          ? new Date(body.expectedDelivery)
          : null,
        transporterName: body.transporterName ?? null,
        lrNumber: body.lrNumber ?? null,
        deliveryInstructions: body.deliveryInstructions ?? null,
        items: {
          create: body.items.map((i) => ({
            product: { connect: { id: i.productId } },
            qty: i.qty,
            price: i.price,
            unit: i.unit ?? null,
          })),
        },
        statusHistory: {
          create: [{ status, changedBy: { connect: { id: user.userId } } }],
        },
      },
      include: ORDER_INCLUDE,
    });
    return toRow(created);
  }

  /**
   * Scalar edits and/or a status transition. A status change appends a
   * status-history entry; moving to Cancelled stamps cancelReason + cancelledAt.
   * Salespeople may only edit orders they own.
   */
  async update(
    user: RequestUser,
    id: string,
    patch: OrderUpdate,
  ): Promise<OrderRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await this.loadOwned(db, user, id);

    const data: Prisma.SalesOrderUpdateInput = {};
    if (patch.isUrgent !== undefined) data.isUrgent = patch.isUrgent;
    if ('paymentTerms' in patch) data.paymentTerms = patch.paymentTerms ?? null;
    if ('advanceAmount' in patch)
      data.advanceAmount = patch.advanceAmount ?? null;
    if ('advanceRef' in patch) data.advanceRef = patch.advanceRef ?? null;
    if ('deliveryMode' in patch) data.deliveryMode = patch.deliveryMode ?? null;
    if ('deliveryAddress' in patch)
      data.deliveryAddress = patch.deliveryAddress ?? null;
    if ('expectedDelivery' in patch) {
      data.expectedDelivery = patch.expectedDelivery
        ? new Date(patch.expectedDelivery)
        : null;
    }
    if ('transporterName' in patch)
      data.transporterName = patch.transporterName ?? null;
    if ('lrNumber' in patch) data.lrNumber = patch.lrNumber ?? null;
    if ('deliveryInstructions' in patch)
      data.deliveryInstructions = patch.deliveryInstructions ?? null;

    const statusChanged =
      patch.status !== undefined && patch.status !== existing.status;
    if (statusChanged) {
      data.status = patch.status;
      data.statusHistory = {
        create: [
          {
            status: patch.status!,
            note: patch.statusNote ?? null,
            changedBy: { connect: { id: user.userId } },
          },
        ],
      };
      if (patch.status === 'Cancelled') {
        data.cancelledAt = new Date();
        data.cancelReason = patch.cancelReason ?? null;
      }
    } else if ('cancelReason' in patch) {
      data.cancelReason = patch.cancelReason ?? null;
    }

    const updated = await db.salesOrder.update({
      where: { id },
      data,
      include: ORDER_INCLUDE,
    });
    return toRow(updated);
  }

  /** Soft-delete: set deletedAt so the row drops out of every list. */
  async remove(user: RequestUser, id: string): Promise<void> {
    const db = this.prisma.forTenant(user.tenantId);
    await this.loadOwned(db, user, id);
    await db.salesOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** Loads a live order and enforces sales-only ownership; else throws. */
  private async loadOwned(
    db: TenantPrisma,
    user: RequestUser,
    id: string,
  ): Promise<{ status: OrderWithGraph['status'] }> {
    const existing = await db.salesOrder.findFirst({
      where: { id, deletedAt: null },
      select: { salespersonId: true, status: true },
    });
    if (!existing) throw new NotFoundException('Order not found');
    if (
      (await this.isSalesOnly(db, user.roleId)) &&
      existing.salespersonId !== user.userId
    ) {
      throw new ForbiddenException('Cannot modify another salesperson order');
    }
    return { status: existing.status };
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
