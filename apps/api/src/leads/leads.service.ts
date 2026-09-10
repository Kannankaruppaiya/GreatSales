import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  LeadCreate,
  LeadListQuery,
  LeadListResponse,
  LeadRow,
  LeadUpdate,
  RequestUser,
} from '@greatsales/shared';
import { PrismaService, type TenantPrisma } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Prisma include graph for a {@link LeadRow}. NOTE: `Lead.industryId` is a loose
 * reference — the schema defines no `industry` relation — so the industry name
 * is resolved via a separate batched lookup, not an include.
 */
const LEAD_INCLUDE = {
  salesperson: true,
  products: true,
} satisfies Prisma.LeadInclude;

type LeadWithGraph = Prisma.LeadGetPayload<{ include: typeof LEAD_INCLUDE }>;

function dec(v: Prisma.Decimal | null): number | null {
  return v == null ? null : v.toNumber();
}
function ymd(d: Date | null): string | null {
  return d == null ? null : d.toISOString().slice(0, 10);
}

function toRow(l: LeadWithGraph, industryName: string | null): LeadRow {
  const products = l.products.map((p) => ({
    id: p.id,
    principalId: p.principalId,
    productId: p.productId,
    productName: p.productName,
    brand: p.brand,
    qty: dec(p.qty),
    unit: p.unit,
    price: dec(p.price),
    value: dec(p.value),
  }));
  return {
    id: l.id,
    customerName: l.customerName,
    division: l.division,
    tier: l.tier,
    type: l.type,
    salespersonId: l.salespersonId,
    salespersonName: l.salesperson.name,
    stage: l.stage,
    leadStatus: l.leadStatus,
    industryId: l.industryId,
    industryName,
    subIndustry: l.subIndustry,
    area: l.area,
    address: l.address,
    contactName: l.contactName,
    phone: l.phone,
    whatsapp: l.whatsapp,
    sameAsMobile: l.sameAsMobile,
    email: l.email,
    nextFollowUp: ymd(l.nextFollowUp),
    expClose: ymd(l.expClose),
    stageUpdatedAt: l.stageUpdatedAt?.toISOString() ?? null,
    products,
    totalValue: products.reduce((sum, p) => sum + (p.value ?? 0), 0),
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Tenant-scoped (RLS) lead list, cursor-paginated, role-scoped for sales. */
  async list(
    user: RequestUser,
    query: LeadListQuery,
  ): Promise<LeadListResponse> {
    const db = this.prisma.forTenant(user.tenantId);
    const ownerId = await this.resolveOwnerScope(db, user, query.ownerId);

    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
      ...(ownerId ? { salespersonId: ownerId } : {}),
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.tier ? { tier: query.tier } : {}),
      // Leads carry principal on their line items, not on the lead itself.
      ...(query.principalId
        ? { products: { some: { principalId: query.principalId } } }
        : {}),
      ...(query.search
        ? { customerName: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [rows, total] = await db.$transaction([
      db.lead.findMany({
        where,
        include: LEAD_INCLUDE,
        orderBy: { id: 'asc' },
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      db.lead.count({ where }),
    ]);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const names = await this.industryNames(
      db,
      page.map((l) => l.industryId),
    );
    return {
      items: page.map((l) =>
        toRow(l, l.industryId ? (names.get(l.industryId) ?? null) : null),
      ),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      total,
    };
  }

  /**
   * Every lead in scope, unpaginated, for the dashboard aggregate.
   *
   * Deliberately NOT exposed as an endpoint. The console used to reach the same
   * data by paging `list()` in a loop until it ran out, which is O(leads)
   * round trips to compute six numbers; this exists so DashboardService can do
   * that work once, server-side, in one query.
   *
   * It reuses `toRow` rather than summing LeadProduct values itself — a second
   * implementation of "what is this lead worth" is how a dashboard and a lead
   * list end up disagreeing.
   *
   * Unpaginated is a real risk and is bounded by intent, not by luck: the
   * caller is a single aggregate that runs per dashboard load. If lead counts
   * per tenant grow past a few thousand this must become a SQL aggregate that
   * never materialises the rows — see checklists/09-PERFORMANCE.md I.5.
   */
  async allInScope(user: RequestUser, ownerIdFilter?: string) {
    const db = this.prisma.forTenant(user.tenantId);
    const ownerId = await this.resolveOwnerScope(db, user, ownerIdFilter);

    const rows = await db.lead.findMany({
      where: {
        tenantId: user.tenantId,
        deletedAt: null,
        ...(ownerId ? { salespersonId: ownerId } : {}),
      },
      include: LEAD_INCLUDE,
      orderBy: { id: 'asc' },
    });
    const names = await this.industryNames(
      db,
      rows.map((l) => l.industryId),
    );
    return rows.map((l) =>
      toRow(l, l.industryId ? (names.get(l.industryId) ?? null) : null),
    );
  }

  /** Batch-resolve industry names for a set of (nullable) industry ids. */
  private async industryNames(
    db: TenantPrisma,
    ids: (string | null)[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map();
    const rows = await db.industry.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  /** Create a lead (with optional line items). Salespeople own what they create. */
  async create(user: RequestUser, body: LeadCreate): Promise<LeadRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const salespersonId = (await this.isSalesOnly(db, user.roleId))
      ? user.userId
      : body.salespersonId;

    const created = await db.lead.create({
      data: {
        tenant: { connect: { id: user.tenantId } },
        customerName: body.customerName,
        salesperson: { connect: { id: salespersonId } },
        ...(body.stage ? { stage: body.stage } : {}),
        stageUpdatedAt: new Date(),
        division: body.division ?? null,
        tier: body.tier ?? null,
        type: body.type ?? null,
        leadStatus: body.leadStatus ?? null,
        subIndustry: body.subIndustry ?? null,
        area: body.area ?? null,
        address: body.address ?? null,
        contactName: body.contactName ?? null,
        phone: body.phone ?? null,
        whatsapp: body.whatsapp ?? null,
        ...(body.sameAsMobile !== undefined
          ? { sameAsMobile: body.sameAsMobile }
          : {}),
        email: body.email ?? null,
        nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : null,
        expClose: body.expClose ? new Date(body.expClose) : null,
        industryId: body.industryId ?? null,
        ...(body.products && body.products.length > 0
          ? {
              products: {
                create: body.products.map((p) => ({
                  productName: p.productName,
                  principalId: p.principalId ?? null,
                  productId: p.productId ?? null,
                  brand: p.brand ?? null,
                  qty: p.qty ?? null,
                  unit: p.unit ?? null,
                  price: p.price ?? null,
                  value: p.value ?? null,
                })),
              },
            }
          : {}),
      },
      include: LEAD_INCLUDE,
    });
    // Being handed a lead is not visible anywhere else: by the time the owner
    // opens the list it simply contains a row that was not there before.
    await this.notifications.notify({
      tenantId: user.tenantId,
      userId: salespersonId,
      actorId: user.userId,
      type: 'LeadAssigned',
      title: `New lead: ${created.customerName}`,
      body: 'Assigned to you.',
      entityType: 'Lead',
      entityId: created.id,
    });

    return toRow(created, await this.oneIndustryName(db, created.industryId));
  }

  /** Resolve a single (nullable) industry id to its name. */
  private async oneIndustryName(
    db: TenantPrisma,
    id: string | null,
  ): Promise<string | null> {
    if (!id) return null;
    return (await this.industryNames(db, [id])).get(id) ?? null;
  }

  /** Partial scalar edit. Changing `stage` re-stamps `stageUpdatedAt`. */
  async update(
    user: RequestUser,
    id: string,
    patch: LeadUpdate,
  ): Promise<LeadRow> {
    const db = this.prisma.forTenant(user.tenantId);
    await this.assertOwned(db, user, id);

    // Read before the write: "who owned this a moment ago" is the only way to
    // tell a reassignment from a patch that happens to name the same person.
    const previousOwnerId = (
      await db.lead.findFirst({ where: { id }, select: { salespersonId: true } })
    )?.salespersonId;

    const data: Prisma.LeadUpdateInput = {};
    if (patch.customerName !== undefined)
      data.customerName = patch.customerName;
    if (patch.salespersonId !== undefined)
      data.salesperson = { connect: { id: patch.salespersonId } };
    if (patch.stage !== undefined) {
      data.stage = patch.stage;
      data.stageUpdatedAt = new Date();
    }
    if ('division' in patch) data.division = patch.division ?? null;
    if ('tier' in patch) data.tier = patch.tier ?? null;
    if ('type' in patch) data.type = patch.type ?? null;
    if ('leadStatus' in patch) data.leadStatus = patch.leadStatus ?? null;
    if ('subIndustry' in patch) data.subIndustry = patch.subIndustry ?? null;
    if ('area' in patch) data.area = patch.area ?? null;
    if ('address' in patch) data.address = patch.address ?? null;
    if ('contactName' in patch) data.contactName = patch.contactName ?? null;
    if ('phone' in patch) data.phone = patch.phone ?? null;
    if ('whatsapp' in patch) data.whatsapp = patch.whatsapp ?? null;
    if (patch.sameAsMobile !== undefined)
      data.sameAsMobile = patch.sameAsMobile;
    if ('email' in patch) data.email = patch.email ?? null;
    if ('nextFollowUp' in patch) {
      data.nextFollowUp = patch.nextFollowUp
        ? new Date(patch.nextFollowUp)
        : null;
    }
    if ('expClose' in patch) {
      data.expClose = patch.expClose ? new Date(patch.expClose) : null;
    }
    if ('industryId' in patch) data.industryId = patch.industryId ?? null;

    const updated = await db.lead.update({
      where: { id },
      data,
      include: LEAD_INCLUDE,
    });

    if (
      patch.salespersonId !== undefined &&
      patch.salespersonId !== previousOwnerId
    ) {
      await this.notifications.notify({
        tenantId: user.tenantId,
        userId: patch.salespersonId,
        actorId: user.userId,
        type: 'LeadAssigned',
        title: `Lead moved to you: ${updated.customerName}`,
        entityType: 'Lead',
        entityId: updated.id,
      });
    }

    return toRow(updated, await this.oneIndustryName(db, updated.industryId));
  }

  /** Soft-delete: set deletedAt so the row drops out of every list. */
  async remove(user: RequestUser, id: string): Promise<void> {
    const db = this.prisma.forTenant(user.tenantId);
    await this.assertOwned(db, user, id);
    await db.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async assertOwned(
    db: TenantPrisma,
    user: RequestUser,
    id: string,
  ): Promise<void> {
    const existing = await db.lead.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Lead not found');
    if (
      (await this.isSalesOnly(db, user.roleId)) &&
      existing.salespersonId !== user.userId
    ) {
      throw new ForbiddenException('Cannot modify another salesperson lead');
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
