import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PrincipalCreate,
  PrincipalListResponse,
  PrincipalRow,
  PrincipalUpdate,
  ProductCreate,
  ProductListQuery,
  ProductListResponse,
  ProductRow,
  ProductUpdate,
  RequestUser,
} from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Prisma include graph that carries everything a {@link ProductRow} needs. */
const PRODUCT_INCLUDE = { principal: true } satisfies Prisma.ProductInclude;

type ProductWithGraph = Prisma.ProductGetPayload<{
  include: typeof PRODUCT_INCLUDE;
}>;

function toRow(p: ProductWithGraph): ProductRow {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    division: p.division,
    unit: p.unit,
    basePrice: p.basePrice == null ? null : p.basePrice.toNumber(),
    active: p.active,
    principalId: p.principalId,
    principalName: p.principal.name,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Postgres unique-violation code — surfaced as a 409 to the caller. */
function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
  );
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tenant-scoped (RLS) catalog list, cursor-paginated. */
  async list(
    user: RequestUser,
    query: ProductListQuery,
  ): Promise<ProductListResponse> {
    const db = this.prisma.forTenant(user.tenantId);
    const rows = await db.product.findMany({
      where: {
        deletedAt: null,
        ...(query.principalId ? { principalId: query.principalId } : {}),
        ...(query.active !== undefined ? { active: query.active } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { sku: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: PRODUCT_INCLUDE,
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

  /** Create a catalog product under a principal. */
  async create(user: RequestUser, body: ProductCreate): Promise<ProductRow> {
    const db = this.prisma.forTenant(user.tenantId);
    try {
      const created = await db.product.create({
        data: {
          tenant: { connect: { id: user.tenantId } },
          principal: { connect: { id: body.principalId } },
          name: body.name,
          sku: body.sku ?? null,
          division: body.division ?? null,
          unit: body.unit ?? null,
          basePrice: body.basePrice ?? null,
          ...(body.active !== undefined ? { active: body.active } : {}),
        },
        include: PRODUCT_INCLUDE,
      });
      return toRow(created);
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('SKU already in use');
      }
      throw e;
    }
  }

  /** Partial edit on one product. */
  async update(
    user: RequestUser,
    id: string,
    patch: ProductUpdate,
  ): Promise<ProductRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Product not found');

    const data: Prisma.ProductUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.principalId !== undefined)
      data.principal = { connect: { id: patch.principalId } };
    if ('sku' in patch) data.sku = patch.sku ?? null;
    if ('division' in patch) data.division = patch.division ?? null;
    if ('unit' in patch) data.unit = patch.unit ?? null;
    if ('basePrice' in patch) data.basePrice = patch.basePrice ?? null;
    if (patch.active !== undefined) data.active = patch.active;

    try {
      const updated = await db.product.update({
        where: { id },
        data,
        include: PRODUCT_INCLUDE,
      });
      return toRow(updated);
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('SKU already in use');
      }
      throw e;
    }
  }

  /** Soft-delete: set deletedAt so the row drops out of every list. */
  async remove(user: RequestUser, id: string): Promise<void> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Product not found');
    await db.product.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ===========================================================================
  // Principals Master Data
  // ===========================================================================

  /** List all active principals for the tenant with product count. */
  async listPrincipals(user: RequestUser): Promise<PrincipalListResponse> {
    const db = this.prisma.forTenant(user.tenantId);
    const principals = await db.principal.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: { products: { where: { deletedAt: null } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      items: principals.map((p) => ({
        id: p.id,
        name: p.name,
        productCount: p._count.products,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    };
  }

  /** Create a new principal brand. */
  async createPrincipal(
    user: RequestUser,
    body: PrincipalCreate,
  ): Promise<PrincipalRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const trimmed = body.name.trim();

    const existing = await db.principal.findFirst({
      where: {
        name: { equals: trimmed, mode: 'insensitive' },
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException('A principal with this name already exists');
    }

    const created = await db.principal.create({
      data: {
        tenant: { connect: { id: user.tenantId } },
        name: trimmed,
      },
    });

    return {
      id: created.id,
      name: created.name,
      productCount: 0,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  /** Update an existing principal. */
  async updatePrincipal(
    user: RequestUser,
    id: string,
    body: PrincipalUpdate,
  ): Promise<PrincipalRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.principal.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Principal not found');

    if (body.name) {
      const duplicate = await db.principal.findFirst({
        where: {
          name: { equals: body.name.trim(), mode: 'insensitive' },
          id: { not: id },
          deletedAt: null,
        },
      });
      if (duplicate) {
        throw new ConflictException('A principal with this name already exists');
      }
    }

    const updated = await db.principal.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
      },
      include: {
        _count: {
          select: { products: { where: { deletedAt: null } } },
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      productCount: updated._count.products,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /** Soft delete a principal. */
  async removePrincipal(user: RequestUser, id: string): Promise<void> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.principal.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Principal not found');

    await db.principal.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
