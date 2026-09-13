import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  MappingCreate,
  MappingListQuery,
  MappingListResponse,
  MappingRow,
  MappingUpdate,
  RequestUser,
} from '@greatsales/shared';
import { PrismaService, type TenantPrisma } from '../prisma/prisma.service';
import {
  codedConflict,
  codedNotFound,
  codedBadRequest,
} from '../common/error-codes';

/** Everything a {@link MappingRow} needs, in one query — no N+1 per row. */
const MAPPING_INCLUDE = {
  customer: true,
  salesperson: true,
  product: { include: { principal: true } },
} satisfies Prisma.MappingInclude;

type MappingWithGraph = Prisma.MappingGetPayload<{
  include: typeof MAPPING_INCLUDE;
}>;

const dec = (d: Prisma.Decimal | null): number | null =>
  d == null ? null : d.toNumber();

function toRow(m: MappingWithGraph): MappingRow {
  const basePrice = dec(m.product.basePrice);
  const customPrice = dec(m.customPrice);
  return {
    id: m.id,
    customerId: m.customer.id,
    customerName: m.customer.name,
    productId: m.product.id,
    productName: m.product.name,
    productSku: m.product.sku,
    principalId: m.product.principal.id,
    principalName: m.product.principal.name,
    salespersonId: m.salesperson.id,
    salespersonName: m.salesperson.name,
    basePrice,
    customPrice,
    // Resolved here, never in a client. Two surfaces computing this
    // independently is how a quote and an invoice end up disagreeing.
    effectivePrice: customPrice ?? basePrice,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

/** Postgres unique violation — the (customerId, productId) pair already exists. */
function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
  );
}

@Injectable()
export class MappingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tenant-scoped list. A sales user sees only mappings they own. */
  async list(
    user: RequestUser,
    query: MappingListQuery,
  ): Promise<MappingListResponse> {
    const db = this.prisma.forTenant(user.tenantId);
    const ownerId = await this.resolveOwnerScope(db, user, query.ownerId);

    const where: Prisma.MappingWhereInput = {
      // Explicit tenant filter in addition to RLS: the policy is the net, not
      // the plan (checklists/01-DATABASE.md A.3.8).
      tenantId: user.tenantId,
      deletedAt: null,
      ...(ownerId ? { salespersonId: ownerId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      // Both narrow through `product`, so they are merged into ONE key —
      // spread as two, the second would silently replace the first and a
      // principal+unpriced filter would quietly drop the principal.
      ...(query.principalId || query.unpriced === 'true'
        ? {
            product: {
              ...(query.principalId ? { principalId: query.principalId } : {}),
              ...(query.unpriced === 'true' ? { basePrice: null } : {}),
            },
          }
        : {}),
      // Unpriced means neither side can price it: no agreed override here, and
      // no catalog price behind it (the `product` clause above).
      ...(query.unpriced === 'true' ? { customPrice: null } : {}),
      ...(query.search
        ? {
            OR: [
              {
                customer: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                product: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                product: {
                  sku: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    // limit + 1 so the extra row tells us a next page exists; the count beside
    // it answers "how many in total", which the pickers show as "50 of 417".
    const [rows, total] = await db.$transaction([
      db.mapping.findMany({
        where,
        include: MAPPING_INCLUDE,
        // By the customer whose book it is, then the product — the order
        // somebody scanning this table reads in. It used to be insertion order
        // (`createdAt desc`), which for a seeded book of 883 rows is no order
        // at all. `id` last keeps the total order deterministic, which is what
        // cursor pagination needs to not skip or repeat a row.
        orderBy: [
          { customer: { name: 'asc' } },
          { product: { name: 'asc' } },
          { id: 'asc' },
        ],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      db.mapping.count({ where }),
    ]);

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: items.map(toRow),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      total,
    };
  }

  async create(user: RequestUser, body: MappingCreate): Promise<MappingRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const salespersonId = await this.resolveOwnerAssignment(
      db,
      user,
      body.salespersonId,
    );

    // Validate the FKs through the TENANT-SCOPED client, so a customer or
    // product id belonging to another tenant reads as "not found" rather than
    // producing a foreign-key error that confirms the row exists.
    const [customer, product, salesperson] = await Promise.all([
      db.customer.findFirst({
        where: { id: body.customerId, deletedAt: null },
        select: { id: true },
      }),
      db.product.findFirst({
        where: { id: body.productId, deletedAt: null },
        select: { id: true },
      }),
      db.user.findFirst({
        where: { id: salespersonId, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (!customer)
      throw codedNotFound('CUSTOMER_NOT_FOUND', 'Customer not found.');
    if (!product)
      throw codedNotFound('PRODUCT_NOT_FOUND', 'Product not found.');
    if (!salesperson)
      throw codedNotFound('USER_NOT_FOUND', 'Salesperson not found.');

    try {
      const created = await db.mapping.create({
        data: {
          tenantId: user.tenantId,
          customerId: body.customerId,
          productId: body.productId,
          salespersonId,
          customPrice: body.customPrice ?? null,
        },
        include: MAPPING_INCLUDE,
      });
      return toRow(created);
    } catch (e) {
      if (isUniqueViolation(e)) {
        // A soft-deleted mapping still occupies the unique pair, so say so
        // rather than leaving the user staring at a duplicate they cannot see.
        throw codedConflict(
          'MAPPING_EXISTS',
          'This product is already mapped to this customer. Edit the existing mapping instead.',
        );
      }
      throw e;
    }
  }

  async update(
    user: RequestUser,
    id: string,
    patch: MappingUpdate,
  ): Promise<MappingRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await this.findOwned(db, user, id);

    if (patch.salespersonId && patch.salespersonId !== existing.salespersonId) {
      // Reassignment is an admin action: a sales user handing their mapping to
      // someone else, or taking someone else's, is a scope change.
      if (await this.isSalesOnly(db, user.roleId)) {
        throw codedBadRequest(
          'REASSIGN_FORBIDDEN',
          'Only an administrator can reassign a mapping to another salesperson.',
        );
      }
      const target = await db.user.findFirst({
        where: { id: patch.salespersonId, deletedAt: null },
        select: { id: true },
      });
      if (!target)
        throw codedNotFound('USER_NOT_FOUND', 'Salesperson not found.');
    }

    const updated = await db.mapping.update({
      where: { id },
      data: {
        ...(patch.salespersonId ? { salespersonId: patch.salespersonId } : {}),
        ...(patch.customPrice !== undefined
          ? { customPrice: patch.customPrice }
          : {}),
      },
      include: MAPPING_INCLUDE,
    });
    return toRow(updated);
  }

  /**
   * Soft-deletes a mapping, unless the projections worksheet still depends on
   * it. `Projection.mappingId` is REQUIRED, and the worksheet resolves
   * customer, product, price and owner through it — so removing a mapping out
   * from under a projection leaves a row that cannot render at all.
   */
  async remove(user: RequestUser, id: string): Promise<{ id: string }> {
    const db = this.prisma.forTenant(user.tenantId);
    await this.findOwned(db, user, id);

    const dependents = await db.projection.count({
      where: { mappingId: id },
    });
    if (dependents > 0) {
      throw codedConflict(
        'MAPPING_IN_USE',
        `This mapping is used by ${dependents} projection line${dependents === 1 ? '' : 's'}. Remove those first.`,
      );
    }

    await db.mapping.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  }

  /** Loads a mapping the caller is allowed to touch, or 404s. */
  private async findOwned(
    db: TenantPrisma,
    user: RequestUser,
    id: string,
  ): Promise<MappingWithGraph> {
    const existing = await db.mapping.findFirst({
      where: { id, tenantId: user.tenantId, deletedAt: null },
      include: MAPPING_INCLUDE,
    });
    if (!existing)
      throw codedNotFound('MAPPING_NOT_FOUND', 'Mapping not found.');

    // A sales user reaching another owner's mapping gets 404, not 403: telling
    // them "exists but forbidden" confirms a record they should not know about.
    if (
      (await this.isSalesOnly(db, user.roleId)) &&
      existing.salespersonId !== user.userId
    ) {
      throw codedNotFound('MAPPING_NOT_FOUND', 'Mapping not found.');
    }
    return existing;
  }

  /** For admin/mgmt: honour the requested ownerId filter. For sales: force self. */
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

  /** Who the new mapping belongs to. A sales user cannot assign it away. */
  private async resolveOwnerAssignment(
    db: TenantPrisma,
    user: RequestUser,
    requested?: string,
  ): Promise<string> {
    if (await this.isSalesOnly(db, user.roleId)) return user.userId;
    return requested ?? user.userId;
  }

  private async isSalesOnly(
    db: TenantPrisma,
    roleId: string,
  ): Promise<boolean> {
    const role = await db.role.findUnique({ where: { id: roleId } });
    return role?.name === 'sales';
  }
}
