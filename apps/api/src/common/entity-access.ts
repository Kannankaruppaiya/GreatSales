import { ForbiddenException } from '@nestjs/common';
import type {
  EntityTypeValue,
  PermissionKey,
  RequestUser,
} from '@greatsales/shared';
import type { TenantPrisma } from '../prisma/prisma.service';

/**
 * Authorization for things ATTACHED to a record — remarks, attachments.
 *
 * These inherit the record's own authorization rather than carrying keys of
 * their own. There is deliberately no `remark.read` or `attachment.write`: a
 * note about a payment is payment data and a signed quotation on an order is
 * order data, and a separate key would let a role read the commentary and the
 * paperwork of records it cannot open.
 *
 * It lives here rather than in one service because it now has two callers, and
 * this rule is precisely the kind that is copied once, changed in one copy, and
 * then disagrees with itself in a way no test notices — the sales-scope half
 * especially, which is the half that keeps one rep out of another's accounts.
 */
export const PARENT_PERMISSION: Record<
  EntityTypeValue,
  { read: PermissionKey; write: PermissionKey }
> = {
  Projection: { read: 'projection.read', write: 'projection.write' },
  Lead: { read: 'lead.read', write: 'lead.write' },
  Payment: { read: 'payment.read', write: 'payment.write' },
  Order: { read: 'order.read', write: 'order.write' },
  Customer: { read: 'customer.read', write: 'customer.write' },
};

/** True when the caller's role can only ever act on its own records. */
export async function isSalesOnly(
  db: TenantPrisma,
  roleId: string,
): Promise<boolean> {
  const role = await db.role.findUnique({ where: { id: roleId } });
  return role?.name === 'sales';
}

/**
 * The caller's role must hold the parent entity's permission.
 *
 * PermissionsGuard cannot do this: the required key depends on the
 * `entityType` in the request, which the guard does not read.
 */
export async function assertEntityPermission(
  db: TenantPrisma,
  user: RequestUser,
  entityType: EntityTypeValue,
  action: 'read' | 'write',
  noun: string,
): Promise<void> {
  const needed = PARENT_PERMISSION[entityType][action];
  const held = await db.rolePermission.findFirst({
    where: { roleId: user.roleId, permission: { key: needed } },
    select: { permissionId: true },
  });
  if (!held) {
    throw new ForbiddenException(
      `Requires ${needed} to ${action} ${noun} on a ${entityType}`,
    );
  }
}

/**
 * The parent row must exist and be reachable by this caller.
 *
 * RLS already bounds the lookup to the tenant, so this closes the remaining
 * gap: a sales user must not read or annotate another rep's records, and an id
 * for a row that does not exist must 403 rather than leave an orphan attached
 * to nothing that no screen will ever show.
 */
export async function assertParentVisible(
  db: TenantPrisma,
  user: RequestUser,
  entityType: EntityTypeValue,
  entityId: string,
): Promise<void> {
  const ownerId = (await isSalesOnly(db, user.roleId))
    ? user.userId
    : undefined;
  const owned = ownerId ? { salespersonId: ownerId } : {};

  const found = await (async () => {
    switch (entityType) {
      case 'Customer':
        return db.customer.findFirst({
          where: { id: entityId, deletedAt: null, ...owned },
          select: { id: true },
        });
      case 'Lead':
        return db.lead.findFirst({
          where: { id: entityId, deletedAt: null, ...owned },
          select: { id: true },
        });
      case 'Order':
        return db.salesOrder.findFirst({
          where: { id: entityId, deletedAt: null, ...owned },
          select: { id: true },
        });
      case 'Payment':
        return db.payment.findFirst({
          where: { id: entityId, deletedAt: null, ...owned },
          select: { id: true },
        });
      case 'Projection':
        return db.projection.findFirst({
          where: {
            id: entityId,
            deletedAt: null,
            ...(ownerId ? { mapping: { salespersonId: ownerId } } : {}),
          },
          select: { id: true },
        });
    }
  })();

  if (!found) {
    throw new ForbiddenException(
      `No ${entityType} you can reach with id ${entityId}`,
    );
  }
}

/**
 * A sales-role caller may not hand a record to anybody else.
 *
 * Every owned resource loads the row and refuses one the caller does not own,
 * which proves who owns it NOW and says nothing about who owns it after the
 * patch. `salespersonId` was writable on customers, leads and payments alike,
 * so owning a record was enough to push it onto a colleague — and with it the
 * overdue invoice, the cold lead or the account, off the pusher's own aging
 * and pipeline reports. No console offers that; three direct PATCHes did.
 *
 * Reassignment stays available to admin, which is the role the bulk
 * ReassignCustomers flow already runs as; management holds no write permission
 * at all (see ROLE_PERMISSIONS). So this narrows exactly one role, and it
 * lives here rather than in each service because a rule copied three times is
 * a rule that will be changed in one of them.
 *
 * `requestedOwnerId` is `undefined` when the patch does not name an owner,
 * which is the ordinary case and always allowed.
 */
export function assertOwnerNotTransferred(
  salesOnly: boolean,
  user: RequestUser,
  requestedOwnerId: string | null | undefined,
  noun: string,
): void {
  if (!salesOnly || requestedOwnerId === undefined) return;
  if (requestedOwnerId !== user.userId) {
    throw new ForbiddenException(
      `Only an administrator can reassign a ${noun} to another salesperson`,
    );
  }
}
