import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AddLeadActivityInput,
  CreateLeadInput,
  CursorPage,
  CursorPageQuery,
  Lead,
  LeadDetail,
  RequestUser,
  UpdateLeadInput,
} from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Lead pipeline read/write, tenant-scoped. */
@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: RequestUser,
    query: CursorPageQuery,
  ): Promise<CursorPage<Lead>> {
    const db = this.prisma.forTenant(user.tenantId);
    const rows = await db.lead.findMany({
      where: { deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: items.map(toLead),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async get(user: RequestUser, id: string): Promise<LeadDetail> {
    const db = this.prisma.forTenant(user.tenantId);
    const row = await db.lead.findFirst({
      where: { id, deletedAt: null },
      include: {
        products: true,
        activities: { orderBy: { date: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException('Lead not found');
    return {
      ...toLead(row),
      products: row.products.map((p) => ({
        id: p.id,
        productName: p.productName,
        brand: p.brand,
        value: p.value?.toString() ?? null,
      })),
      activities: row.activities.map((a) => ({
        id: a.id,
        date: a.date.toISOString(),
        note: a.note,
      })),
    };
  }

  async create(user: RequestUser, input: CreateLeadInput): Promise<Lead> {
    const db = this.prisma.forTenant(user.tenantId);
    const row = await db.lead.create({
      data: {
        tenantId: user.tenantId,
        customerName: input.customerName,
        salespersonId: input.salespersonId ?? user.userId,
        stage: input.stage ?? 'NewEnquiries',
        leadStatus: input.leadStatus ?? null,
        industryId: input.industryId ?? null,
        area: input.area ?? null,
        products: input.products?.length
          ? {
              create: input.products.map((p) => ({
                productName: p.productName,
                brand: p.brand ?? null,
                value:
                  p.value !== undefined ? new Prisma.Decimal(p.value) : null,
              })),
            }
          : undefined,
      },
    });
    return toLead(row);
  }

  async update(
    user: RequestUser,
    id: string,
    input: UpdateLeadInput,
  ): Promise<Lead> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.lead.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Lead not found');
    const row = await db.lead.update({
      where: { id },
      data: {
        customerName: input.customerName ?? undefined,
        stage: input.stage ?? undefined,
        leadStatus: input.leadStatus ?? undefined,
        industryId: input.industryId ?? undefined,
        area: input.area ?? undefined,
      },
    });
    return toLead(row);
  }

  async addActivity(
    user: RequestUser,
    id: string,
    input: AddLeadActivityInput,
  ): Promise<LeadDetail> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.lead.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Lead not found');
    await db.leadActivity.create({
      data: { leadId: id, note: input.note },
    });
    return this.get(user, id);
  }
}

function toLead(row: {
  id: string;
  customerName: string;
  salespersonId: string;
  stage: Lead['stage'];
  leadStatus: Lead['leadStatus'];
  industryId: string | null;
  area: string | null;
  createdAt: Date;
}): Lead {
  return {
    id: row.id,
    customerName: row.customerName,
    salespersonId: row.salespersonId,
    stage: row.stage,
    leadStatus: row.leadStatus,
    industryId: row.industryId,
    area: row.area,
    createdAt: row.createdAt.toISOString(),
  };
}
