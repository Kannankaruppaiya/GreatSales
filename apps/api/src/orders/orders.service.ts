import {
  BadRequestException,
  ConflictException,
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
import { NotificationsService } from '../notifications/notifications.service';
import { PeriodLocksService } from '../period-locks/period-locks.service';
import {
  canTransition,
  computeOrderTotals,
  lineTotal,
  validateTaxSpec,
  type OrderStatusName,
  type OrderTotals,
  type TaxSpec,
} from './order-engine';

/** Prisma include graph that carries everything an {@link OrderRow} needs. */
/**
 * Status words for a notification, which is read as a sentence rather than
 * scanned in a column. The enum's own spelling ("DeliveredFromWarehouse")
 * belongs in a payload, not in a line somebody reads on their phone.
 */
const ORDER_STATUS_WORDS: Record<string, string> = {
  Created: 'created',
  Acknowledged: 'acknowledged',
  DeliveryPartnerAssigned: 'with the delivery partner',
  DeliveredFromWarehouse: 'out for delivery',
  DeliveredToCustomer: 'delivered',
  CustomerReceiptConfirmed: 'confirmed received',
  Cancelled: 'cancelled',
};

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
    subtotal: dec(o.subtotal) ?? 0,
    taxMode: o.taxMode,
    taxRate: dec(o.taxRate),
    taxAmount: dec(o.taxAmount) ?? 0,
    total: dec(o.total) ?? 0,
    isUrgent: o.isUrgent,
    paymentTerms: o.paymentTerms,
    advanceAmount: dec(o.advanceAmount),
    advanceRef: o.advanceRef,
    deliveryMode: o.deliveryMode,
    deliveryAddress: o.deliveryAddress,
    // The full instant, not ymd(). A delivery promise is a moment — the create
    // form collects a date AND a time for an urgent order — and truncating it
    // to a date here threw the time away twice over: the SLA report compared
    // the actual delivery against UTC midnight of the promised day, and the
    // detail modal rendered that midnight back through a local-time formatter
    // as "05:30 am" on every order.
    expectedDelivery: o.expectedDelivery?.toISOString() ?? null,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Tenant-scoped (RLS) order list, cursor-paginated, role-scoped for sales. */
  async list(
    user: RequestUser,
    query: OrderListQuery,
  ): Promise<OrderListResponse> {
    const db = this.prisma.forTenant(user.tenantId);
    const ownerId = await this.resolveOwnerScope(db, user, query.ownerId);

    const where: Prisma.SalesOrderWhereInput = {
      deletedAt: null,
      ...(ownerId ? { salespersonId: ownerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      // Principal reaches an order through its line items' products.
      ...(query.principalId
        ? {
            items: {
              some: { product: { principalId: query.principalId } },
            },
          }
        : {}),
      // Three fields, because the page's own search box offers three: "Search
      // SO no., customer, or transporter". It matched the code alone, so
      // typing a customer name — the thing anyone actually remembers about an
      // order — returned an empty table. Same OR shape the payments list uses.
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              {
                customer: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                transporterName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await db.$transaction([
      db.salesOrder.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { id: 'asc' },
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      db.salesOrder.count({ where }),
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
   * Create an order with its line items. Every money figure is computed
   * server-side from the items and the tax mode (never trusted from the
   * client), and an initial status-history entry is recorded. Salespeople
   * always own what they create.
   *
   * The projection guard, the period-lock check, the order and the link all
   * run inside ONE transaction. They used to be four separate round trips, so
   * two requests converting the same worksheet line at once both read
   * `salesOrderId` as null, both passed the already-converted check, and both
   * raised an order — leaving the customer committed twice and the line
   * pointing at whichever order happened to write its id last.
   */
  async create(user: RequestUser, body: OrderCreate): Promise<OrderRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const salespersonId = (await this.isSalesOnly(db, user.roleId))
      ? user.userId
      : body.salespersonId;
    // An order is born at the bottom of the ladder. Accepting any status here
    // let a caller create one already delivered, with a one-entry trail and no
    // acknowledgement or dispatch behind it — the same broken shape the
    // transition guard on update() exists to prevent.
    if (body.status && body.status !== 'Created') {
      throw new BadRequestException(
        'A new order starts at Created; advance it through the fulfilment stages instead',
      );
    }
    const status = 'Created';
    const totals = this.totalsFor(body.items, {
      mode: body.taxMode ?? 'None',
      rate: body.taxRate,
      amount: body.taxAmount,
    });

    const created = await this.prisma.transactionForTenant(
      user.tenantId,
      async (tx) => {
        // Read through the transaction's own client, so a line belonging to
        // another tenant reads as missing rather than as a foreign-key error,
        // and so the guard below is on the same connection as the write.
        const projection = body.projectionId
          ? await tx.projection.findFirst({
              where: { id: body.projectionId, deletedAt: null },
              select: {
                id: true,
                salesOrderId: true,
                period: true,
                salesOrder: { select: { status: true } },
              },
            })
          : null;
        if (body.projectionId) {
          if (!projection) {
            throw new NotFoundException('Projection not found');
          }
          // One order per line — but a CANCELLED order is not one. The
          // worksheet already treats a cancelled link as no link and offers
          // "Create SO" again, so reading the raw pointer here refused the
          // very button the page was showing, and left the line unable to be
          // removed either.
          const liveOrder =
            projection.salesOrderId != null &&
            projection.salesOrder?.status !== 'Cancelled';
          if (liveOrder) {
            throw new ConflictException(
              'This projection line has already been converted to a sales order',
            );
          }
          if (
            await PeriodLocksService.isLocked(
              tx as unknown as TenantPrisma,
              projection.period,
            )
          ) {
            throw new ForbiddenException(
              `${projection.period} is locked for reporting and cannot be edited`,
            );
          }
        }

        const order = await tx.salesOrder.create({
          data: {
            tenant: { connect: { id: user.tenantId } },
            code: body.code,
            customer: { connect: { id: body.customerId } },
            salesperson: { connect: { id: salespersonId } },
            createdBy: { connect: { id: user.userId } },
            status,
            ...totals,
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

        // The link, in the same transaction as the order: a worksheet line that
        // says "Order Placed" now has an order id behind it, and the line's
        // delete guard has something real to refuse on.
        //
        // Written as a compare-and-set against the pointer this transaction
        // READ, not a plain update. A second converter racing this one blocks
        // on the row lock, re-evaluates the WHERE against the committed value,
        // matches nothing, and rolls its own order back — the invariant is
        // held by Postgres rather than by the order the two requests happened
        // to arrive in. No advisory lock and no retry loop.
        if (projection) {
          const linked = await tx.projection.updateMany({
            where: { id: projection.id, salesOrderId: projection.salesOrderId },
            data: { salesOrderId: order.id },
          });
          if (linked.count === 0) {
            throw new ConflictException(
              'This projection line has already been converted to a sales order',
            );
          }
        }

        return order;
      },
    );
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

    // Line items, and the money that follows from them. Only while the order
    // is a draft: once the warehouse has acknowledged it, the quantities are a
    // commitment somebody is acting on, and silently rewriting them under a
    // dispatch in progress is worse than refusing.
    if (patch.items !== undefined) {
      if (existing.status !== 'Created') {
        throw new BadRequestException(
          'Line items can only be changed while the order is still Created',
        );
      }
      data.items = {
        deleteMany: {},
        create: patch.items.map((i) => ({
          product: { connect: { id: i.productId } },
          qty: i.qty,
          price: i.price,
          unit: i.unit ?? null,
        })),
      };
    }

    // The three money columns move together or not at all, and they are
    // re-derived from whichever lines the order will HAVE once this patch
    // lands — the new ones if it carries them, otherwise the stored ones. A
    // patch that only corrects the GST rate therefore reprices the order
    // without needing the lines restated, and one that only replaces the lines
    // keeps the tax treatment the order was raised under.
    const taxTouched =
      'taxMode' in patch || 'taxRate' in patch || 'taxAmount' in patch;
    if (patch.items !== undefined || taxTouched) {
      const items = patch.items ?? existing.items;
      Object.assign(
        data,
        this.totalsFor(items, {
          mode: patch.taxMode ?? existing.taxMode,
          rate: 'taxRate' in patch ? patch.taxRate : dec(existing.taxRate),
          amount:
            'taxAmount' in patch ? patch.taxAmount : dec(existing.taxAmount),
        }),
      );
    }
    if (patch.date !== undefined) data.date = new Date(patch.date);
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
      // The ladder is enforced HERE, not in the modal that happens to walk it.
      if (
        !canTransition(
          existing.status as OrderStatusName,
          patch.status as OrderStatusName,
        )
      ) {
        throw new BadRequestException(
          `An order cannot move from ${existing.status} to ${patch.status}`,
        );
      }
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

    if (statusChanged) {
      // The owner is told, not the person who moved it: warehouse and office
      // staff advance other people's orders, and the salesperson is the one
      // who has to answer the customer for where it is.
      await this.notifications.notify({
        tenantId: user.tenantId,
        userId: updated.salespersonId,
        actorId: user.userId,
        type: 'OrderUpdate',
        title: `${updated.code} is now ${ORDER_STATUS_WORDS[updated.status] ?? updated.status}`,
        body: patch.statusNote ?? null,
        entityType: 'Order',
        entityId: updated.id,
      });
    }

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

  /**
   * Loads a live order and enforces sales-only ownership; else throws.
   *
   * It carries the stored tax spec and line items back with it, because a
   * patch that touches only one of the two still has to reprice the order from
   * both — see the money block in `update`.
   */
  private async loadOwned(
    db: TenantPrisma,
    user: RequestUser,
    id: string,
  ): Promise<{
    status: OrderWithGraph['status'];
    taxMode: OrderWithGraph['taxMode'];
    taxRate: Prisma.Decimal | null;
    taxAmount: Prisma.Decimal | null;
    items: { qty: number; price: number }[];
  }> {
    const existing = await db.salesOrder.findFirst({
      where: { id, deletedAt: null },
      select: {
        salespersonId: true,
        status: true,
        taxMode: true,
        taxRate: true,
        taxAmount: true,
        items: { select: { qty: true, price: true } },
      },
    });
    if (!existing) throw new NotFoundException('Order not found');
    if (
      (await this.isSalesOnly(db, user.roleId)) &&
      existing.salespersonId !== user.userId
    ) {
      throw new ForbiddenException('Cannot modify another salesperson order');
    }
    return {
      status: existing.status,
      taxMode: existing.taxMode,
      taxRate: existing.taxRate,
      taxAmount: existing.taxAmount,
      items: existing.items.map((i) => ({
        qty: i.qty.toNumber(),
        price: i.price.toNumber(),
      })),
    };
  }

  /**
   * The order's money, validated and derived in one place.
   *
   * Both `create` and `update` go through here, so there is exactly one
   * implementation of what an order is worth — the arithmetic in the engine,
   * and the refusal of a spec that names a mode without the figure that mode
   * needs.
   */
  private totalsFor(
    items: { qty: number; price: number }[],
    tax: TaxSpec,
  ): OrderTotals {
    const problem = validateTaxSpec(tax);
    if (problem) throw new BadRequestException(problem);
    return computeOrderTotals(items, tax);
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
