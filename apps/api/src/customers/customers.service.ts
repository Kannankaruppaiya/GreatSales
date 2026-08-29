import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CustomerContactCreate,
  CustomerContactListResponse,
  CustomerContactRow,
  CustomerContactUpdate,
  CustomerCreate,
  CustomerListQuery,
  CustomerListResponse,
  CustomerRow,
  CustomerUpdate,
  RequestUser,
} from '@greatsales/shared';
import {
  PrismaService,
  type TenantPrisma,
  type TenantTx,
} from '../prisma/prisma.service';

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

function toContactRow(
  c: Prisma.CustomerContactGetPayload<object>,
): CustomerContactRow {
  return {
    id: c.id,
    customerId: c.customerId,
    name: c.name,
    designation: c.designation,
    phone: c.phone,
    mobile: c.mobile,
    whatsapp: c.whatsapp,
    sameAsMobile: c.sameAsMobile,
    email: c.email,
    isPrimary: c.isPrimary,
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

    const rows = await db.customer.findMany({
      where: {
        deletedAt: null,
        ...(ownerId ? { salespersonId: ownerId } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.active !== undefined ? { active: query.active } : {}),
        ...(query.search
          ? { name: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      include: CUSTOMER_INCLUDE,
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

  // ============================================================
  // CONTACTS (sub-resource) — tenancy + ownership enforced via the parent
  // customer. Every write runs in one tenant transaction so the ownership
  // check, the "demote the old primary" step, and the write itself see one
  // snapshot and can never momentarily leave two primaries.
  // ============================================================

  /** All contacts for one customer, primary first then oldest. */
  async listContacts(
    user: RequestUser,
    customerId: string,
  ): Promise<CustomerContactListResponse> {
    return this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      await this.assertCustomerOwnedTx(tx, user, customerId);
      const rows = await tx.customerContact.findMany({
        where: { customerId },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      });
      return { items: rows.map(toContactRow) };
    });
  }

  /**
   * Add a contact. The FIRST contact a customer gets is always primary;
   * otherwise `isPrimary: true` promotes it and demotes the current primary.
   */
  async createContact(
    user: RequestUser,
    customerId: string,
    body: CustomerContactCreate,
  ): Promise<CustomerContactRow> {
    return this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      await this.assertCustomerOwnedTx(tx, user, customerId);
      const count = await tx.customerContact.count({ where: { customerId } });
      const makePrimary = count === 0 ? true : (body.isPrimary ?? false);
      if (makePrimary) await this.demotePrimary(tx, customerId);

      const created = await tx.customerContact.create({
        data: {
          customer: { connect: { id: customerId } },
          name: body.name,
          designation: body.designation ?? null,
          phone: body.phone ?? null,
          mobile: body.mobile ?? null,
          whatsapp: body.whatsapp ?? null,
          ...(body.sameAsMobile !== undefined
            ? { sameAsMobile: body.sameAsMobile }
            : {}),
          email: body.email ?? null,
          isPrimary: makePrimary,
        },
      });
      return toContactRow(created);
    });
  }

  /**
   * Partial edit. `isPrimary: true` promotes this contact (demoting the old
   * primary); `isPrimary: false` is ignored — a customer with contacts always
   * keeps exactly one primary, so the flag moves by promoting a different one.
   */
  async updateContact(
    user: RequestUser,
    customerId: string,
    contactId: string,
    patch: CustomerContactUpdate,
  ): Promise<CustomerContactRow> {
    return this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      await this.assertCustomerOwnedTx(tx, user, customerId);
      const existing = await tx.customerContact.findFirst({
        where: { id: contactId, customerId },
        select: { isPrimary: true },
      });
      if (!existing) throw new NotFoundException('Contact not found');

      const data: Prisma.CustomerContactUpdateInput = {};
      if (patch.name !== undefined) data.name = patch.name;
      if ('designation' in patch) data.designation = patch.designation ?? null;
      if ('phone' in patch) data.phone = patch.phone ?? null;
      if ('mobile' in patch) data.mobile = patch.mobile ?? null;
      if ('whatsapp' in patch) data.whatsapp = patch.whatsapp ?? null;
      if (patch.sameAsMobile !== undefined)
        data.sameAsMobile = patch.sameAsMobile;
      if ('email' in patch) data.email = patch.email ?? null;
      if (patch.isPrimary === true && !existing.isPrimary) {
        await this.demotePrimary(tx, customerId);
        data.isPrimary = true;
      }

      const updated = await tx.customerContact.update({
        where: { id: contactId },
        data,
      });
      return toContactRow(updated);
    });
  }

  /**
   * Delete a contact. If it was the primary and other contacts remain, the
   * oldest is promoted so the account never ends up with contacts but no
   * primary (which would blank its list row).
   */
  async removeContact(
    user: RequestUser,
    customerId: string,
    contactId: string,
  ): Promise<void> {
    await this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      await this.assertCustomerOwnedTx(tx, user, customerId);
      const existing = await tx.customerContact.findFirst({
        where: { id: contactId, customerId },
        select: { isPrimary: true },
      });
      if (!existing) throw new NotFoundException('Contact not found');

      await tx.customerContact.delete({ where: { id: contactId } });

      if (existing.isPrimary) {
        const next = await tx.customerContact.findFirst({
          where: { customerId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (next) {
          await tx.customerContact.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
        }
      }
    });
  }

  /** Clear the current primary so a new one can be set without colliding. */
  private async demotePrimary(tx: TenantTx, customerId: string): Promise<void> {
    await tx.customerContact.updateMany({
      where: { customerId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  /**
   * Parent-customer gate for every contact operation: the customer must be
   * live and visible to this tenant (RLS), and a sales-only caller must own it.
   * A cross-tenant id is invisible under RLS, so it answers 404.
   */
  private async assertCustomerOwnedTx(
    tx: TenantTx,
    user: RequestUser,
    customerId: string,
  ): Promise<void> {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { salespersonId: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    const role = await tx.role.findUnique({
      where: { id: user.roleId },
      select: { name: true },
    });
    if (role?.name === 'sales' && customer.salespersonId !== user.userId) {
      throw new ForbiddenException(
        'Cannot modify another salesperson customer',
      );
    }
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
