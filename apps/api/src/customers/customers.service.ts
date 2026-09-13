import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ContactRow,
  CustomerCreate,
  PermissionKey,
  CustomerListQuery,
  CustomerListResponse,
  CustomerRow,
  CustomerUpdate,
  RequestUser,
} from '@greatsales/shared';
import { mapsUrl } from '@greatsales/shared';
import {
  PrismaService,
  type TenantPrisma,
  type TenantTx,
} from '../prisma/prisma.service';
import { PeriodLocksService } from '../period-locks/period-locks.service';
import { assertOwnerNotTransferred } from '../common/entity-access';
import { contactWrites, contactsFor, primaryOf } from '../common/contacts';
import { NotificationsService } from '../notifications/notifications.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

/** Prisma include graph that carries everything a {@link CustomerRow} needs. */
const CUSTOMER_INCLUDE = {
  industry: true,
  salesperson: true,
  collector: true,
  locationPinnedBy: true,
} satisfies Prisma.CustomerInclude;

type CustomerWithGraph = Prisma.CustomerGetPayload<{
  include: typeof CUSTOMER_INCLUDE;
}>;

function dec(v: Prisma.Decimal | null): number {
  return v == null ? 0 : v.toNumber();
}

function toRow(c: CustomerWithGraph, contacts: ContactRow[]): CustomerRow {
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
    // Every contact, not only the first. The include used to be
    // `where isPrimary take 1`, so a customer's second and third contacts were
    // stored and unreachable — see the 20260912100000 migration.
    contacts,
    primaryContactName: primaryOf(contacts).contactName,
    primaryContactPhone: primaryOf(contacts).phone,
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
        ? {
            mappings: { some: { product: { principalId: query.principalId } } },
          }
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
    // One query for the whole page, not one per customer.
    const contacts = await contactsFor(
      db,
      'Customer',
      page.map((c) => c.id),
    );
    return {
      items: page.map((c) => toRow(c, contacts.get(c.id) ?? [])),
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
    return toRow(
      existing,
      (await contactsFor(db, 'Customer', [id])).get(id) ?? [],
    );
  }

  /**
   * Create a customer, and optionally the products it buys and the worksheet
   * lines for them — in ONE transaction.
   *
   * `body.mappings` and `body.period` are what make an account usable the
   * moment it is created. A recurring-sales customer with no mapping can never
   * appear on the projections worksheet (`Projection.mappingId` is required),
   * and a mapping with no line in the open month cannot appear either — so
   * onboarding an account in three separate requests leaves two ways to end up
   * with a customer nobody can project against. Everything here commits
   * together or not at all.
   */
  async create(user: RequestUser, body: CustomerCreate): Promise<CustomerRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const salespersonId = (await this.isSalesOnly(db, user.roleId))
      ? user.userId
      : body.salespersonId;

    const seeds = body.mappings ?? [];

    if (seeds.length > 0) {
      // `customer.write` got us into this method; writing mappings and
      // projection lines is a different grant, and the default `sales` role
      // happens to hold both. A custom role need not — so the check is here
      // rather than assumed from the route.
      await this.assertGranted(db, user, 'projection.write');
    }

    // Checked BEFORE anything is written: a closed month is frozen for
    // everyone, the same rule ProjectionsService enforces on an edit.
    if (body.period && (await PeriodLocksService.isLocked(db, body.period))) {
      throw new ForbiddenException(
        `${body.period} is locked for reporting and cannot be edited`,
      );
    }

    // Product ids are resolved through the TENANT-SCOPED client, so one
    // belonging to another tenant reads as "not found" rather than surfacing
    // as a foreign-key error that confirms the row exists.
    if (seeds.length > 0) {
      const found = await db.product.findMany({
        where: { id: { in: seeds.map((m) => m.productId) }, deletedAt: null },
        select: { id: true },
      });
      const ok = new Set(found.map((p) => p.id));
      const missing = seeds.map((m) => m.productId).filter((id) => !ok.has(id));
      if (missing.length > 0) {
        throw new BadRequestException(
          `Unknown product${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`,
        );
      }
    }

    const hasContact =
      body.contactName !== undefined ||
      body.phone !== undefined ||
      body.whatsapp !== undefined ||
      body.email !== undefined ||
      body.designation !== undefined;

    if (body.latitude != null && body.longitude != null) {
      await this.features.assertEnabled(user.tenantId, 'customer-location');
    }

    const created = await this.prisma.transactionForTenant(
      user.tenantId,
      async (tx) => {
        const customer = await tx.customer.create({
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
          },
          include: CUSTOMER_INCLUDE,
        });

        // `Contact` is polymorphic, so it cannot be nested inside the create —
        // there is no id to point at until the customer row exists.
        if (hasContact) {
          await tx.contact.createMany({
            data: contactWrites(user.tenantId, 'Customer', customer.id, [
              {
                name: body.contactName?.trim() || body.name,
                phone: body.phone ?? null,
                whatsapp: body.whatsapp ?? null,
                sameAsMobile: body.sameAsMobile ?? true,
                email: body.email ?? null,
                designation: body.designation ?? null,
                isPrimary: true,
              },
            ]),
          });
        }

        await this.seedMappings(tx, user, customer.id, salespersonId, body);
        return customer;
      },
    );

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

    return toRow(
      created,
      (await contactsFor(db, 'Customer', [created.id])).get(created.id) ?? [],
    );
  }

  /** Partial edit. Salespeople may only edit accounts they own. */
  async update(
    user: RequestUser,
    id: string,
    patch: CustomerUpdate,
  ): Promise<CustomerRow> {
    const db = this.prisma.forTenant(user.tenantId);
    await this.assertOwned(db, user, id);
    assertOwnerNotTransferred(
      await this.isSalesOnly(db, user.roleId),
      user,
      patch.salespersonId,
      'customer',
    );

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
      data.locationAccuracyM = pinned
        ? (patch.locationAccuracyM ?? null)
        : null;
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
      const primaryContact = await db.contact.findFirst({
        where: { entityType: 'Customer', entityId: id, isPrimary: true },
      });

      if (primaryContact) {
        const contactData: Prisma.ContactUpdateInput = {};
        if ('contactName' in patch)
          contactData.name = patch.contactName?.trim() || primaryContact.name;
        if ('phone' in patch) {
          contactData.phone = patch.phone?.trim() || null;
        }
        if ('whatsapp' in patch)
          contactData.whatsapp = patch.whatsapp?.trim() || null;
        if ('sameAsMobile' in patch)
          contactData.sameAsMobile = patch.sameAsMobile ?? true;
        if ('email' in patch) contactData.email = patch.email?.trim() || null;
        if ('designation' in patch)
          contactData.designation = patch.designation?.trim() || null;

        await db.contact.update({
          where: { id: primaryContact.id },
          data: contactData,
        });
      } else if (
        patch.contactName ||
        patch.phone ||
        patch.whatsapp ||
        patch.email
      ) {
        await db.contact.create({
          data: {
            tenantId: user.tenantId,
            entityType: 'Customer',
            entityId: id,
            name: patch.contactName?.trim() || 'Primary Contact',
            phone: patch.phone?.trim() || null,
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

    return toRow(
      updated,
      (await contactsFor(db, 'Customer', [updated.id])).get(updated.id) ?? [],
    );
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

  /**
   * Refuse unless the caller's role actually holds `key`.
   *
   * The route's own `@RequirePermissions` covers the customer write. This is
   * for the extra writes `create` can carry — mappings and projection lines —
   * which belong to a different module's grant. Fail-closed, the same way
   * PermissionsGuard is.
   */
  private async assertGranted(
    db: TenantPrisma,
    user: RequestUser,
    key: PermissionKey,
  ): Promise<void> {
    const role = await db.role.findUnique({
      where: { id: user.roleId },
      include: { permissions: { include: { permission: true } } },
    });
    const granted = new Set(
      role?.permissions.map((rp) => rp.permission.key) ?? [],
    );
    if (!granted.has(key)) {
      throw new ForbiddenException('Missing required permission');
    }
  }

  /**
   * The products a new account buys, and the worksheet lines for them.
   *
   * Runs inside `create`'s transaction, so a bad product id or a duplicate
   * rolls the customer back with it rather than leaving an account behind.
   *
   * A projection line is written only when the caller named a `period`, and it
   * is written BLANK — quantity zero, status `ProjectionCreated`. That is
   * exactly what the worksheet's "Unprojected" filter is for: the line is
   * present to be committed against, and nothing here pretends a commitment
   * has been made.
   */
  private async seedMappings(
    tx: TenantTx,
    user: RequestUser,
    customerId: string,
    salespersonId: string,
    body: CustomerCreate,
  ): Promise<void> {
    const seeds = body.mappings ?? [];
    if (seeds.length === 0) return;

    // createMany would not give back the ids the projection rows need, and a
    // brand-new customer has at most 50 of these.
    const mappings = await Promise.all(
      seeds.map((seed) =>
        tx.mapping.create({
          data: {
            tenantId: user.tenantId,
            customerId,
            productId: seed.productId,
            salespersonId,
            customPrice: seed.customPrice ?? null,
          },
          select: { id: true, customPrice: true },
        }),
      ),
    );

    if (!body.period) return;

    await tx.projection.createMany({
      data: mappings.map((m) => ({
        tenantId: user.tenantId,
        mappingId: m.id,
        period: body.period as string,
        committedQty: 0,
        achievedQty: 0,
        // The agreed price when there is one, so the line prices itself the
        // way the mapping does rather than falling through to the catalog.
        price: m.customPrice,
        status: 'ProjectionCreated' as const,
      })),
    });
  }
}
