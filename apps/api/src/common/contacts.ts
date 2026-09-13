import { Prisma } from '@prisma/client';
import type { ContactInput, ContactRow } from '@greatsales/shared';
import type { TenantPrisma } from '../prisma/prisma.service';

/**
 * The people at a record, read and written the same way wherever they hang.
 *
 * `Contact` is polymorphic (see the 20260912100000 migration), so it has no
 * Prisma relation to reach through and no `include` that can carry it. Both
 * services that own contacts would otherwise grow their own copy of the
 * grouping, the ordering and the "exactly one primary" write — three chances
 * for a lead's contacts and a customer's to behave differently.
 */

type ContactRecord = {
  id: string;
  name: string;
  designation: string | null;
  phone: string | null;
  whatsapp: string | null;
  sameAsMobile: boolean;
  email: string | null;
  isPrimary: boolean;
};

export function toContactRow(c: ContactRecord): ContactRow {
  return {
    id: c.id,
    name: c.name,
    designation: c.designation,
    phone: c.phone,
    whatsapp: c.whatsapp,
    sameAsMobile: c.sameAsMobile,
    email: c.email,
    isPrimary: c.isPrimary,
  };
}

/**
 * Every listed record's contacts, in ONE query.
 *
 * A per-row lookup would be an N+1 on a page of twenty leads, and the list
 * endpoint is the hottest read in the product.
 */
export async function contactsFor(
  db: TenantPrisma,
  entityType: 'Lead' | 'Customer',
  entityIds: string[],
): Promise<Map<string, ContactRow[]>> {
  const byEntity = new Map<string, ContactRow[]>();
  if (entityIds.length === 0) return byEntity;

  const rows = await db.contact.findMany({
    where: { entityType, entityId: { in: entityIds } },
    // Primary first, then the order somebody put them in. A list cell and the
    // printed paperwork both read [0], so this order IS the contract.
    orderBy: [
      { isPrimary: 'desc' },
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  });
  for (const row of rows) {
    const list = byEntity.get(row.entityId) ?? [];
    list.push(toContactRow(row));
    byEntity.set(row.entityId, list);
  }
  return byEntity;
}

/**
 * Replace a record's contacts with exactly what was sent.
 *
 * Replace rather than merge, for the same reason line items are replaced: a
 * contact has no stable identity a client could address, and "these are the
 * contacts now" is the only instruction that can express somebody having left.
 *
 * The primary is normalised here rather than trusted — the schema already
 * refuses a payload without exactly one, and this makes the stored row match
 * the order it arrived in even if that ever changes.
 */
export function contactWrites(
  tenantId: string,
  entityType: 'Lead' | 'Customer',
  entityId: string,
  inputs: ContactInput[],
): Prisma.ContactCreateManyInput[] {
  const primaryAt = Math.max(
    0,
    inputs.findIndex((c) => c.isPrimary),
  );
  return inputs.map((c, i) => {
    const phone = c.phone?.trim() || null;
    const sameAsMobile = c.sameAsMobile ?? true;
    return {
      tenantId,
      entityType,
      entityId,
      name: c.name.trim(),
      designation: c.designation?.trim() || null,
      phone,
      // Mirrored, not asked for twice — the form offers one tick for it.
      whatsapp: sameAsMobile ? phone : c.whatsapp?.trim() || null,
      sameAsMobile,
      email: c.email?.trim() || null,
      isPrimary: i === primaryAt,
      sortOrder: i,
    };
  });
}

/** The name and number a list cell shows, from an already-ordered list. */
export function primaryOf(contacts: ContactRow[]): {
  contactName: string | null;
  phone: string | null;
} {
  const primary = contacts.find((c) => c.isPrimary) ?? contacts[0] ?? null;
  return {
    contactName: primary?.name ?? null,
    phone: primary?.phone ?? null,
  };
}
