import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateCustomerInput,
  CursorPage,
  CustomerDetail,
  CustomerListItem,
  CustomerListQuery,
  RequestUser,
  UpdateCustomerInput,
} from '@greatsales/shared';
import { AuthzService } from '../authz/authz.service';
import { PrismaService, type TenantPrisma } from '../prisma/prisma.service';

// Fields included for a customer detail response (contacts + relation names).
const detailInclude = {
  contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
  industry: { select: { name: true } },
  salesperson: { select: { name: true } },
} satisfies Prisma.CustomerInclude;

type CustomerWithRelations = Prisma.CustomerGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
  ) {}

  /**
   * Data-scope filter. Tenant isolation is enforced by RLS; this narrows to the
   * caller's OWN customers unless they have tenant-wide visibility
   * (management/admin). RLS cannot express this per-user rule, so the service
   * must — never trust the client to send its own salespersonId filter.
   */
  private async scopeWhere(user: RequestUser): Promise<{ db: TenantPrisma; ownFilter: object }> {
    const scope = await this.authz.getScope(user);
    const db = this.prisma.forTenant(user.tenantId);
    return { db, ownFilter: scope.canSeeAllData ? {} : { salespersonId: user.userId } };
  }

  async list(user: RequestUser, query: CustomerListQuery): Promise<CursorPage<CustomerListItem>> {
    const { db, ownFilter } = await this.scopeWhere(user);

    const where = {
      deletedAt: null,
      ...ownFilter,
      ...(query.category ? { category: query.category } : {}),
      ...(query.payZone ? { payZone: query.payZone } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const rows = await db.customer.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        category: true,
        payZone: true,
        area: true,
        salespersonId: true,
        createdAt: true,
        salesperson: { select: { name: true } },
      },
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        payZone: c.payZone,
        area: c.area,
        salespersonId: c.salespersonId,
        salespersonName: c.salesperson?.name ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async get(user: RequestUser, id: string): Promise<CustomerDetail> {
    const { db, ownFilter } = await this.scopeWhere(user);
    const c = await db.customer.findFirst({
      where: { id, deletedAt: null, ...ownFilter },
      include: detailInclude,
    });
    if (!c) throw new NotFoundException('Customer not found');
    return this.toDetail(c);
  }

  async create(user: RequestUser, input: CreateCustomerInput): Promise<CustomerDetail> {
    const scope = await this.authz.getScope(user);
    const db = this.prisma.forTenant(user.tenantId);

    // Salespeople may only create customers assigned to themselves; only
    // tenant-wide roles may assign to another salesperson.
    const salespersonId =
      scope.canSeeAllData && input.salespersonId ? input.salespersonId : user.userId;
    if (salespersonId !== user.userId) {
      const target = await db.user.findFirst({
        where: { id: salespersonId, deletedAt: null, active: true },
        select: { id: true },
      });
      if (!target) throw new BadRequestException('Assigned salesperson not found');
    }
    await this.assertIndustry(db, input.industryId);

    const created = await db.customer.create({
      data: {
        tenantId: user.tenantId,
        name: input.name,
        category: input.category ?? null,
        industryId: input.industryId ?? null,
        subIndustry: input.subIndustry ?? null,
        area: input.area ?? null,
        paymentTerms: input.paymentTerms ?? null,
        payZone: input.payZone ?? null,
        salespersonId,
        contacts: input.contacts?.length
          ? {
              create: input.contacts.map((ct) => ({
                name: ct.name,
                designation: ct.designation ?? null,
                phone: ct.phone ?? null,
                email: ct.email ? ct.email : null,
                isPrimary: ct.isPrimary ?? false,
              })),
            }
          : undefined,
      },
      include: detailInclude,
    });
    return this.toDetail(created);
  }

  async update(user: RequestUser, id: string, input: UpdateCustomerInput): Promise<CustomerDetail> {
    const scope = await this.authz.getScope(user);
    const db = this.prisma.forTenant(user.tenantId);

    const existing = await db.customer.findFirst({
      where: { id, deletedAt: null, ...(scope.canSeeAllData ? {} : { salespersonId: user.userId }) },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Customer not found');

    if (input.industryId !== undefined) await this.assertIndustry(db, input.industryId);

    // Reassignment is a tenant-wide privilege; salespeople can't move ownership.
    let salespersonId: string | undefined;
    if (input.salespersonId && scope.canSeeAllData) {
      const target = await db.user.findFirst({
        where: { id: input.salespersonId, deletedAt: null, active: true },
        select: { id: true },
      });
      if (!target) throw new BadRequestException('Assigned salesperson not found');
      salespersonId = input.salespersonId;
    }

    const updated = await db.customer.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category ?? null } : {}),
        ...(input.industryId !== undefined ? { industryId: input.industryId ?? null } : {}),
        ...(input.subIndustry !== undefined ? { subIndustry: input.subIndustry ?? null } : {}),
        ...(input.area !== undefined ? { area: input.area ?? null } : {}),
        ...(input.paymentTerms !== undefined ? { paymentTerms: input.paymentTerms ?? null } : {}),
        ...(input.payZone !== undefined ? { payZone: input.payZone ?? null } : {}),
        ...(salespersonId ? { salespersonId } : {}),
      },
      include: detailInclude,
    });
    return this.toDetail(updated);
  }

  async remove(user: RequestUser, id: string): Promise<{ id: string }> {
    const { db, ownFilter } = await this.scopeWhere(user);
    const existing = await db.customer.findFirst({
      where: { id, deletedAt: null, ...ownFilter },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Customer not found');
    // Soft delete only (spec: no hard delete).
    await db.customer.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  }

  private async assertIndustry(db: TenantPrisma, industryId?: string | null): Promise<void> {
    if (!industryId) return;
    const industry = await db.industry.findUnique({ where: { id: industryId }, select: { id: true } });
    if (!industry) throw new BadRequestException('Industry not found');
  }

  private toDetail(c: CustomerWithRelations): CustomerDetail {
    return {
      id: c.id,
      name: c.name,
      category: c.category,
      industryId: c.industryId,
      industryName: c.industry?.name ?? null,
      subIndustry: c.subIndustry,
      area: c.area,
      paymentTerms: c.paymentTerms,
      payZone: c.payZone,
      salespersonId: c.salespersonId,
      salespersonName: c.salesperson?.name ?? null,
      contacts: c.contacts.map((ct) => ({
        id: ct.id,
        name: ct.name,
        designation: ct.designation,
        phone: ct.phone,
        email: ct.email,
        isPrimary: ct.isPrimary,
      })),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}
