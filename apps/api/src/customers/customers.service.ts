import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateCustomerInput,
  Customer,
  CustomerDetail,
  CursorPage,
  CursorPageQuery,
  RequestUser,
  UpdateCustomerInput,
} from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Customer read/write, all scoped to the caller's tenant via forTenant (RLS
 * enforces isolation even if a where-clause forgets the tenant filter).
 */
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: RequestUser,
    query: CursorPageQuery,
  ): Promise<CursorPage<Customer>> {
    const db = this.prisma.forTenant(user.tenantId);
    const rows = await db.customer.findMany({
      where: { deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: items.map(toCustomer),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async get(user: RequestUser, id: string): Promise<CustomerDetail> {
    const db = this.prisma.forTenant(user.tenantId);
    const row = await db.customer.findFirst({
      where: { id, deletedAt: null },
      include: { contacts: { orderBy: { isPrimary: 'desc' } } },
    });
    if (!row) throw new NotFoundException('Customer not found');
    return {
      ...toCustomer(row),
      contacts: row.contacts.map((c) => ({
        id: c.id,
        name: c.name,
        designation: c.designation,
        phone: c.phone,
        email: c.email,
        isPrimary: c.isPrimary,
      })),
    };
  }

  async create(
    user: RequestUser,
    input: CreateCustomerInput,
  ): Promise<Customer> {
    const db = this.prisma.forTenant(user.tenantId);
    const row = await db.customer.create({
      data: {
        tenantId: user.tenantId,
        name: input.name,
        category: input.category ?? null,
        industryId: input.industryId ?? null,
        subIndustry: input.subIndustry ?? null,
        area: input.area ?? null,
        paymentTerms: input.paymentTerms ?? null,
        payZone: input.payZone ?? null,
        salespersonId: input.salespersonId ?? user.userId,
      },
    });
    return toCustomer(row);
  }

  async update(
    user: RequestUser,
    id: string,
    input: UpdateCustomerInput,
  ): Promise<Customer> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.customer.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Customer not found');
    const row = await db.customer.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        category: input.category ?? undefined,
        industryId: input.industryId ?? undefined,
        subIndustry: input.subIndustry ?? undefined,
        area: input.area ?? undefined,
        paymentTerms: input.paymentTerms ?? undefined,
        payZone: input.payZone ?? undefined,
        salespersonId: input.salespersonId ?? undefined,
      },
    });
    return toCustomer(row);
  }

  async remove(user: RequestUser, id: string): Promise<{ id: string }> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.customer.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Customer not found');
    await db.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id };
  }
}

function toCustomer(row: {
  id: string;
  name: string;
  category: Customer['category'];
  industryId: string | null;
  subIndustry: string | null;
  area: string | null;
  paymentTerms: Customer['paymentTerms'];
  payZone: Customer['payZone'];
  salespersonId: string;
  createdAt: Date;
}): Customer {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    industryId: row.industryId,
    subIndustry: row.subIndustry,
    area: row.area,
    paymentTerms: row.paymentTerms,
    payZone: row.payZone,
    salespersonId: row.salespersonId,
    createdAt: row.createdAt.toISOString(),
  };
}
