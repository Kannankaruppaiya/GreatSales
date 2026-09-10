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
import { mapsUrl } from '@greatsales/shared';
import { PrismaService, type TenantPrisma } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

/** Prisma include graph that carries everything a {@link CustomerRow} needs. */
const CUSTOMER_INCLUDE = {
  industry: true,
  salesperson: true,
  collector: true,
  locationPinnedBy: true,
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
  // Decimal → number, and null stays null: an unpinned customer must not
  // become 0,0.
  const lat = c.latitude == null ? null : c.latitude.toNumber();
  const lng = c.longitude == null ? null : c.longitude.toNumber();
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
    latitude: lat,
    longitude: lng,
    locationAccuracyM: c.locationAccuracyM,
    locationPinnedAt: c.locationPinnedAt?.toISOString() ?? null,
    locationPinnedById: c.locationPinnedById,
    locationPinnedByName: c.locationPinnedBy?.name ?? null,
    // Built here, not in each client: three UIs sharing one link format is
    // three chances to format it differently.
    locationUrl: mapsUrl(lat, lng),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly features: FeatureFlagsService,
  ) {}

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

    const hasContact =
      body.contactName !== undefined ||
      body.phone !== undefined ||
      body.whatsapp !== undefined ||
      body.email !== undefined ||
      body.designation !== undefined;

    if (body.latitude != null && body.longitude != null) {
      await this.features.assertEnabled(user.tenantId, 'customer-location');
    }

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
        // The pin is stamped, never trusted from the client: `pinnedAt` is
        // server time and `pinnedBy` is the caller, so a stale or forged
        // "who and when" cannot be posted alongside the coordinates.
        // Gated above by `customer-location`, on the server — a workspace that
        // has switched location tracking off must not be able to store one by
        // posting the field directly.
        ...(body.latitude != null && body.longitude != null
          ? {
              latitude: body.latitude,
              longitude: body.longitude,
              locationAccuracyM: body.locationAccuracyM ?? null,
              locationPinnedAt: new Date(),
              locationPinnedBy: { connect: { id: user.userId } },
            }
          : {}),
        ...(hasContact
          ? {
              contacts: {
                create: {
                  name: body.contactName?.trim() || body.name,
                  phone: body.phone?.trim() || null,
                  mobile: body.phone?.trim() || null,
                  whatsapp:
                    body.whatsapp?.trim() ||
                    (body.sameAsMobile
                      ? body.phone?.trim() || null
                      : null),
                  sameAsMobile: body.sameAsMobile ?? true,
                  email: body.email?.trim() || null,
                  designation: body.designation?.trim() || null,
                  isPrimary: true,
                },
              },
            }
          : {}),
      },
      include: CUSTOMER_INCLUDE,
    });
    await this.notifications.notify({
      tenantId: user.tenantId,
      userId: salespersonId,
      actorId: user.userId,
      type: 'CustomerAssigned',
      title: `New account: ${created.name}`,
      body: 'Assigned to you.',
      entityType: 'Customer',
      entityId: created.id,
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

    // Read before the write, so a patch that names the same owner is not
    // reported as a reassignment.
    const previousOwnerId = (
      await db.customer.findFirst({
        where: { id },
        select: { salespersonId: true },
      })
    )?.salespersonId;

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

    // Re-pinning and clearing are both meaningful edits, and the schema has
    // already guaranteed the two coordinates arrive together. Clearing drops
    // the stamp too, so a cleared pin leaves no misleading "pinned by X" behind.
    if ('latitude' in patch || 'longitude' in patch) {
      const pinned = patch.latitude != null && patch.longitude != null;
      // Clearing a pin stays allowed with the feature off: a workspace that has
      // just switched location tracking off must be able to remove what it
      // already stored, which is most of the reason it switched it off.
      if (pinned) {
        await this.features.assertEnabled(user.tenantId, 'customer-location');
      }
      data.latitude = pinned ? patch.latitude : null;
      data.longitude = pinned ? patch.longitude : null;
      data.locationAccuracyM = pinned ? (patch.locationAccuracyM ?? null) : null;
      data.locationPinnedAt = pinned ? new Date() : null;
      data.locationPinnedBy = pinned
        ? { connect: { id: user.userId } }
        : { disconnect: true };
    }

    const hasContactPatch =
      'contactName' in patch ||
      'phone' in patch ||
      'whatsapp' in patch ||
      'sameAsMobile' in patch ||
      'email' in patch ||
      'designation' in patch;

    if (hasContactPatch) {
      const primaryContact = await db.customerContact.findFirst({
        where: { customerId: id, isPrimary: true },
      });

      if (primaryContact) {
        const contactData: Prisma.CustomerContactUpdateInput = {};
        if ('contactName' in patch)
          contactData.name = patch.contactName?.trim() || primaryContact.name;
        if ('phone' in patch) {
          contactData.phone = patch.phone?.trim() || null;
          contactData.mobile = patch.phone?.trim() || null;
        }
        if ('whatsapp' in patch)
          contactData.whatsapp = patch.whatsapp?.trim() || null;
        if ('sameAsMobile' in patch)
          contactData.sameAsMobile = patch.sameAsMobile ?? true;
        if ('email' in patch)
          contactData.email = patch.email?.trim() || null;
        if ('designation' in patch)
          contactData.designation = patch.designation?.trim() || null;

        await db.customerContact.update({
          where: { id: primaryContact.id },
          data: contactData,
        });
      } else if (
        patch.contactName ||
        patch.phone ||
        patch.whatsapp ||
        patch.email
      ) {
        await db.customerContact.create({
          data: {
            customerId: id,
            name: patch.contactName?.trim() || 'Primary Contact',
            phone: patch.phone?.trim() || null,
            mobile: patch.phone?.trim() || null,
            whatsapp:
              patch.whatsapp?.trim() ||
              (patch.sameAsMobile ? patch.phone?.trim() || null : null),
            sameAsMobile: patch.sameAsMobile ?? true,
            email: patch.email?.trim() || null,
            designation: patch.designation?.trim() || null,
            isPrimary: true,
          },
        });
      }
    }

    const updated = await db.customer.update({
      where: { id },
      data,
      include: CUSTOMER_INCLUDE,
    });

    if (
      patch.salespersonId !== undefined &&
      patch.salespersonId !== previousOwnerId
    ) {
      await this.notifications.notify({
        tenantId: user.tenantId,
        userId: patch.salespersonId,
        actorId: user.userId,
        type: 'CustomerAssigned',
        title: `Account moved to you: ${updated.name}`,
        entityType: 'Customer',
        entityId: updated.id,
      });
    }

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
