import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CustomerCreate,
  CustomerListQuery,
  CustomerListResponse,
  CustomerRow,
  CustomerUpdate,
  RequestUser,
} from '@greatsales/shared';
import { PrismaService, type TenantPrisma } from '../prisma/prisma.service';

/** Prisma include graph that carries everything a {@link CustomerRow} needs. */
const CUSTOMER_INCLUDE = {
  industry: true,
  salesperson: true,
  collector: true,
  contacts: { where: { isPrimary: true }, take: 1 },
} satisfies Prisma.CustomerInclude;

type CustomerWithGraph = Prisma.CustomerGetPayload<{
  include: typeof CUSTOMER_INCLUDE;
}>;

function dec(v: Prisma.Decimal | null): number {
  return v == null ? 0 : v.toNumber();
}

function toRow(c: CustomerWithGraph): CustomerRow {
  const contact = c.contacts[0] ?? null;
  return {
    id: c.id,
    name: c.name,
    division: c.division,
    category: c.category,
    type: c.type,
    industryId: c.industryId,
    industryName: c.industry?.name ?? null,
    subIndustry: c.subIndustry,
    area: c.area,
    paymentTerms: c.paymentTerms,
    payZone: c.payZone,
    outstanding: dec(c.outstanding),
    active: c.active,
    salespersonId: c.salespersonId,
    salespersonName: c.salesperson.name,
    collectorId: c.collectorId,
    collectorName: c.collector?.name ?? null,
    primaryContactName: contact?.name ?? null,
    primaryContactPhone: contact?.mobile ?? contact?.phone ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tenant-scoped (RLS) customer list, cursor-paginated. Salespeople see only
   * their own accounts; admin/management see all and may filter by `ownerId`.
   */
  async list(
    user: RequestUser,
    query: CustomerListQuery,
  ): Promise<CustomerListResponse> {
    const db = this.prisma.forTenant(user.tenantId);
    const ownerId = await this.resolveOwnerScope(db, user, query.ownerId);

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(ownerId ? { salespersonId: ownerId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.area ? { area: query.area } : {}),
      ...(query.industryId ? { industryId: query.industryId } : {}),
      // A customer has no principal column; the relation is
      // customer → mappings → product → principal, so this is a `some` filter.
      ...(query.principalId
        ? { mappings: { some: { product: { principalId: query.principalId } } } }
        : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    // Page and count in ONE transaction: read separately, a concurrent insert
    // makes the header total disagree with the rows under it.
    const [rows, total] = await db.$transaction([
      db.customer.findMany({
        where,
        include: CUSTOMER_INCLUDE,
        orderBy: { id: 'asc' },
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      db.customer.count({ where }),
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
   * Fetch a single customer by id with tenant RLS isolation.
   */
  async getById(user: RequestUser, id: string): Promise<CustomerRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.customer.findFirst({
      where: { id, deletedAt: null },
      include: CUSTOMER_INCLUDE,
    });
    if (!existing) throw new NotFoundException('Customer not found');
    return toRow(existing);
  }

  /** Create a customer. Salespeople always own what they create. */
  async create(user: RequestUser, body: CustomerCreate): Promise<CustomerRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const salespersonId = (await this.isSalesOnly(db, user.roleId))
      ? user.userId
      : body.salespersonId;

    const created = await db.customer.create({
      data: {
        tenant: { connect: { id: user.tenantId } },
        name: body.name,
        salesperson: { connect: { id: salespersonId } },
        division: body.division ?? null,
        category: body.category ?? null,
        type: body.type ?? null,
        subIndustry: body.subIndustry ?? null,
        area: body.area ?? null,
        paymentTerms: body.paymentTerms ?? null,
        payZone: body.payZone ?? null,
        ...(body.outstanding !== undefined
          ? { outstanding: body.outstanding }
          : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.industryId
          ? { industry: { connect: { id: body.industryId } } }
          : {}),
        ...(body.collectorId
          ? { collector: { connect: { id: body.collectorId } } }
          : {}),
      },
      include: CUSTOMER_INCLUDE,
    });
    return toRow(created);
  }

  /** Partial edit. Salespeople may only edit accounts they own. */
  async update(
    user: RequestUser,
    id: string,
    patch: CustomerUpdate,
  ): Promise<CustomerRow> {
    const db = this.prisma.forTenant(user.tenantId);
    await this.assertOwned(db, user, id);

    const data: Prisma.CustomerUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.salespersonId !== undefined)
      data.salesperson = { connect: { id: patch.salespersonId } };
    if ('division' in patch) data.division = patch.division ?? null;
    if ('category' in patch) data.category = patch.category ?? null;
    if ('type' in patch) data.type = patch.type ?? null;
    if ('subIndustry' in patch) data.subIndustry = patch.subIndustry ?? null;
    if ('area' in patch) data.area = patch.area ?? null;
    if ('paymentTerms' in patch) data.paymentTerms = patch.paymentTerms ?? null;
    if ('payZone' in patch) data.payZone = patch.payZone ?? null;
    if (patch.outstanding !== undefined) data.outstanding = patch.outstanding;
    if (patch.active !== undefined) data.active = patch.active;
    if ('industryId' in patch) {
      data.industry = patch.industryId
        ? { connect: { id: patch.industryId } }
        : { disconnect: true };
    }
    if ('collectorId' in patch) {
      data.collector = patch.collectorId
        ? { connect: { id: patch.collectorId } }
        : { disconnect: true };
    }

    const updated = await db.customer.update({
      where: { id },
      data,
      include: CUSTOMER_INCLUDE,
    });
    return toRow(updated);
  }

  /** Soft-delete: set deletedAt so the row drops out of every list. */
  async remove(user: RequestUser, id: string): Promise<void> {
    const db = this.prisma.forTenant(user.tenantId);
    await this.assertOwned(db, user, id);
    await db.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** Loads a live customer and enforces sales-only ownership; else throws. */
  private async assertOwned(
    db: TenantPrisma,
    user: RequestUser,
    id: string,
  ): Promise<void> {
    const existing = await db.customer.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Customer not found');
    if (
      (await this.isSalesOnly(db, user.roleId)) &&
      existing.salespersonId !== user.userId
    ) {
      throw new ForbiddenException(
        'Cannot modify another salesperson customer',
      );
    }
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
