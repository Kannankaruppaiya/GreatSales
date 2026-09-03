import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateOrderInput,
  CursorPage,
  CursorPageQuery,
  Order,
  OrderDetail,
  RequestUser,
  UpdateOrderStatusInput,
} from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';

const OPEN_STATUSES = ['Draft', 'Confirmed', 'Dispatched'] as const;

/** Sales-order read/write, tenant-scoped. */
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: RequestUser,
    query: CursorPageQuery,
  ): Promise<CursorPage<Order>> {
    const db = this.prisma.forTenant(user.tenantId);
    const rows = await db.salesOrder.findMany({
      where: { deletedAt: null },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: { customer: { select: { name: true } } },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: items.map(toOrder),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async get(user: RequestUser, id: string): Promise<OrderDetail> {
    const db = this.prisma.forTenant(user.tenantId);
    const row = await db.salesOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
        statusHistory: { orderBy: { at: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException('Order not found');
    return {
      ...toOrder(row),
      items: row.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product.name,
        qty: i.qty.toString(),
        price: i.price.toString(),
      })),
      statusHistory: row.statusHistory.map((h) => ({
        id: h.id,
        status: h.status,
        at: h.at.toISOString(),
      })),
    };
  }

  async create(user: RequestUser, input: CreateOrderInput): Promise<Order> {
    const db = this.prisma.forTenant(user.tenantId);

    const customer = await db.customer.findFirst({
      where: { id: input.customerId, deletedAt: null },
    });
    if (!customer) throw new BadRequestException('Unknown customer');

    const total = input.items.reduce(
      (sum, i) => sum.plus(new Prisma.Decimal(i.qty).times(i.price)),
      new Prisma.Decimal(0),
    );

    const row = await db.salesOrder.create({
      data: {
        tenantId: user.tenantId,
        customerId: input.customerId,
        salespersonId: input.salespersonId ?? user.userId,
        status: 'Draft',
        total,
        items: {
          create: input.items.map((i) => ({
            productId: i.productId,
            qty: new Prisma.Decimal(i.qty),
            price: new Prisma.Decimal(i.price),
          })),
        },
        statusHistory: {
          create: { status: 'Draft', changedById: user.userId },
        },
      },
      include: { customer: { select: { name: true } } },
    });
    return toOrder(row);
  }

  async updateStatus(
    user: RequestUser,
    id: string,
    input: UpdateOrderStatusInput,
  ): Promise<Order> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.salesOrder.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Order not found');

    const row = await db.salesOrder.update({
      where: { id },
      data: {
        status: input.status,
        statusHistory: {
          create: { status: input.status, changedById: user.userId },
        },
      },
      include: { customer: { select: { name: true } } },
    });
    return toOrder(row);
  }
}

function toOrder(row: {
  id: string;
  customerId: string;
  customer: { name: string };
  salespersonId: string;
  date: Date;
  status: Order['status'];
  total: Prisma.Decimal;
}): Order {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customer.name,
    salespersonId: row.salespersonId,
    date: row.date.toISOString(),
    status: row.status,
    total: row.total.toString(),
  };
}

export { OPEN_STATUSES };
