import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AddPaymentFollowupInput,
  CreatePaymentInput,
  CursorPage,
  CursorPageQuery,
  Payment,
  PaymentDetail,
  RequestUser,
  UpdatePaymentInput,
} from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Receivables read/write, tenant-scoped. */
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: RequestUser,
    query: CursorPageQuery,
  ): Promise<CursorPage<Payment>> {
    const db = this.prisma.forTenant(user.tenantId);
    const rows = await db.payment.findMany({
      where: { deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: { customer: { select: { name: true } } },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: items.map((r) => toPayment(r)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async get(user: RequestUser, id: string): Promise<PaymentDetail> {
    const db = this.prisma.forTenant(user.tenantId);
    const row = await db.payment.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: { select: { name: true } },
        followups: { orderBy: { date: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException('Payment not found');
    return {
      ...toPayment(row),
      followups: row.followups.map((f) => ({
        id: f.id,
        date: f.date.toISOString(),
        note: f.note,
        nextFollowupDate: f.nextFollowupDate?.toISOString() ?? null,
      })),
    };
  }

  async create(user: RequestUser, input: CreatePaymentInput): Promise<Payment> {
    const db = this.prisma.forTenant(user.tenantId);
    const customer = await db.customer.findFirst({
      where: { id: input.customerId, deletedAt: null },
    });
    if (!customer) throw new BadRequestException('Unknown customer');

    const dueDate = input.dueDate ? new Date(input.dueDate) : null;
    const row = await db.payment.create({
      data: {
        tenantId: user.tenantId,
        customerId: input.customerId,
        invoiceNo: input.invoiceNo,
        amount: new Prisma.Decimal(input.amount),
        dueDate,
        agingDays: agingDays(dueDate),
        payZone: input.payZone ?? null,
        status: 'Pending',
      },
      include: { customer: { select: { name: true } } },
    });
    return toPayment(row);
  }

  async update(
    user: RequestUser,
    id: string,
    input: UpdatePaymentInput,
  ): Promise<Payment> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.payment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Payment not found');
    const dueDate =
      input.dueDate !== undefined ? new Date(input.dueDate) : existing.dueDate;
    const row = await db.payment.update({
      where: { id },
      data: {
        status: input.status ?? undefined,
        payZone: input.payZone ?? undefined,
        dueDate: input.dueDate !== undefined ? dueDate : undefined,
        agingDays: input.dueDate !== undefined ? agingDays(dueDate) : undefined,
      },
      include: { customer: { select: { name: true } } },
    });
    return toPayment(row);
  }

  async addFollowup(
    user: RequestUser,
    id: string,
    input: AddPaymentFollowupInput,
  ): Promise<PaymentDetail> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.payment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Payment not found');
    await db.paymentFollowup.create({
      data: {
        paymentId: id,
        note: input.note,
        nextFollowupDate: input.nextFollowupDate
          ? new Date(input.nextFollowupDate)
          : null,
      },
    });
    return this.get(user, id);
  }
}

function agingDays(dueDate: Date | null): number | null {
  if (!dueDate) return null;
  const ms = Date.now() - dueDate.getTime();
  return ms > 0 ? Math.floor(ms / 86_400_000) : 0;
}

function toPayment(row: {
  id: string;
  customerId: string;
  customer: { name: string };
  invoiceNo: string;
  amount: Prisma.Decimal;
  dueDate: Date | null;
  agingDays: number | null;
  payZone: Payment['payZone'];
  status: Payment['status'];
}): Payment {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customer.name,
    invoiceNo: row.invoiceNo,
    amount: row.amount.toString(),
    dueDate: row.dueDate?.toISOString() ?? null,
    agingDays: row.agingDays,
    payZone: row.payZone,
    status: row.status,
  };
}
