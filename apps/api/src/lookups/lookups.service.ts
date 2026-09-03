import { Injectable } from '@nestjs/common';
import type { Lookups, RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Reference lists for mobile pickers (customer/product/salesperson/industry). */
@Injectable()
export class LookupsService {
  constructor(private readonly prisma: PrismaService) {}

  async all(user: RequestUser): Promise<Lookups> {
    const db = this.prisma.forTenant(user.tenantId);
    const [customers, products, salespeople, industries] = await Promise.all([
      db.customer.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      db.product.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, basePrice: true, unit: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      db.user.findMany({
        where: { deletedAt: null, active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      db.industry.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      customers: customers.map((c) => ({ id: c.id, label: c.name })),
      products: products.map((p) => ({
        id: p.id,
        label: p.name,
        basePrice: p.basePrice?.toString() ?? null,
        unit: p.unit,
      })),
      salespeople: salespeople.map((u) => ({ id: u.id, label: u.name })),
      industries: industries.map((i) => ({ id: i.id, label: i.name })),
    };
  }
}
