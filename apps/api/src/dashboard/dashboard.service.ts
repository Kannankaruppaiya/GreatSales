import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  DashboardSummary,
  DealStage,
  RequestUser,
} from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Aggregated home-screen metrics, computed under the caller's tenant scope. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: RequestUser): Promise<DashboardSummary> {
    const db = this.prisma.forTenant(user.tenantId);

    const [
      customers,
      leads,
      openOrders,
      orderRevenue,
      receivables,
      overdueInvoices,
      pipelineRows,
    ] = await Promise.all([
      db.customer.count({ where: { deletedAt: null } }),
      db.lead.count({ where: { deletedAt: null } }),
      db.salesOrder.count({
        where: {
          deletedAt: null,
          status: { in: ['Draft', 'Confirmed', 'Dispatched'] },
        },
      }),
      db.salesOrder.aggregate({
        _sum: { total: true },
        where: { deletedAt: null, status: { not: 'Cancelled' } },
      }),
      db.payment.aggregate({
        _sum: { amount: true },
        where: { deletedAt: null, status: { not: 'Paid' } },
      }),
      db.payment.count({ where: { deletedAt: null, status: 'Overdue' } }),
      db.lead.groupBy({
        by: ['stage'],
        _count: { _all: true },
        where: { deletedAt: null },
      }),
    ]);

    return {
      customers,
      leads,
      openOrders,
      orderRevenue: (
        orderRevenue._sum.total ?? new Prisma.Decimal(0)
      ).toString(),
      outstandingReceivables: (
        receivables._sum.amount ?? new Prisma.Decimal(0)
      ).toString(),
      overdueInvoices,
      pipeline: pipelineRows.map((r) => ({
        stage: r.stage as DealStage,
        count: r._count._all,
      })),
    };
  }
}
