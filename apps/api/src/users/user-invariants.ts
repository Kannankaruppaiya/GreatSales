import { Prisma } from '@prisma/client';
import {
  PASSWORD_FAILURE_MESSAGE,
  validatePassword,
  type PasswordIdentity,
} from '@greatsales/shared';
import { codedBadRequest, codedConflict } from '../common/error-codes';

/**
 * The rules that keep user administration correct and recoverable.
 *
 * Kept out of UsersService so each one can be read, reasoned about, and tested
 * on its own, and so the service reads as a sequence of named guarantees
 * rather than a wall of conditionals.
 */

/**
 * Canonical identity form.
 *
 * Case and surrounding whitespace are not identity. Without this, `Admin@x`
 * and `admin@x` are two accounts — and the partial unique index cannot tell
 * them apart either, so the database will not save us. Applied SERVER-side
 * because the client lower-casing a username is advice that a direct API call
 * ignores entirely.
 */
export function normalizeIdentity<
  T extends { email?: string; username?: string; name?: string },
>(input: T): T {
  const out = { ...input };
  if (out.email !== undefined) out.email = out.email.trim().toLowerCase();
  if (out.username !== undefined)
    out.username = out.username.trim().toLowerCase();
  if (out.name !== undefined) out.name = out.name.trim();
  return out;
}

/**
 * Applies the shared password policy and converts a failure into a coded 400.
 *
 * The policy itself lives in `@greatsales/shared` and is imported by the web
 * client too, so the two cannot drift into disagreeing about what is
 * acceptable.
 */
export function assertPasswordPolicy(
  plain: string,
  identity: PasswordIdentity,
): void {
  const result = validatePassword(plain, identity);
  if (!result.ok) {
    throw codedBadRequest(
      'WEAK_PASSWORD',
      PASSWORD_FAILURE_MESSAGE[result.reason],
    );
  }
}

/**
 * Translates a Prisma write failure into the API's error contract.
 *
 * P2025 ("an operation failed because it depends on one or more records that
 * were required but not found") is what a nested `connect` to a non-existent —
 * or cross-tenant, which RLS makes indistinguishable from non-existent — role,
 * manager, or team raises. Untranslated it surfaced as a 500: no code for the
 * client to branch on, and an on-call page for what is really a typo.
 *
 * Declared `never` so callers can use it as the whole body of a catch block
 * and TypeScript still sees the function as returning a value.
 */
export function mapPrismaWriteError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      throw codedConflict(
        'DUPLICATE_IDENTITY',
        'That email or username is already in use in this workspace.',
      );
    }
    if (e.code === 'P2025' || e.code === 'P2003') {
      throw codedBadRequest(
        'INVALID_REFERENCE',
        'The selected role, manager, or team does not exist in this workspace.',
      );
    }
  }
  throw e;
}

/**
 * A reporting chain longer than this is a data error, not an org chart.
 *
 * The bound also guarantees the walk terminates even if a cycle already exists
 * in the data — introduced by a direct database edit, say, before this check
 * was in place.
 */
export const MAX_MANAGER_DEPTH = 64;

/** The minimal read surface {@link assertManagerAcyclic} needs. */
export interface ManagerLookup {
  user: {
    findFirst(args: {
      where: { id: string; deletedAt?: null; active?: boolean };
      select: { id: true; managerId: true };
    }): Promise<{ id: string; managerId: string | null } | null>;
  };
}

/**
 * Rejects a manager assignment that is impossible, or that would close a cycle.
 *
 * Walks UP from the proposed manager. If `userId` appears anywhere on that
 * path, assigning it would close the loop. A dangling parent — a manager whose
 * own manager has been hard-deleted — is not a cycle, so the walk simply ends.
 *
 * Tenant scoping, soft-delete, and deactivation are all handled by the
 * RLS-bound client plus the `where` clause: a cross-tenant id is not found,
 * which is the same answer as "does not exist", which is the same answer the
 * caller deserves.
 *
 * Takes the transaction client so the check and the write see the same
 * snapshot.
 */
export async function assertManagerAcyclic(
  db: ManagerLookup,
  userId: string | null,
  managerId: string,
): Promise<void> {
  const reject = () =>
    codedBadRequest(
      'INVALID_MANAGER',
      'That manager is not available: they must be an active user in this workspace, and cannot create a reporting loop.',
    );

  if (userId && managerId === userId) throw reject();

  let current = await db.user.findFirst({
    where: { id: managerId, deletedAt: null, active: true },
    select: { id: true, managerId: true },
  });
  if (!current) throw reject();

  for (let depth = 0; depth < MAX_MANAGER_DEPTH; depth++) {
    if (!current.managerId) return; // reached the root — no cycle
    if (userId && current.managerId === userId) throw reject();

    current = await db.user.findFirst({
      where: { id: current.managerId, deletedAt: null },
      select: { id: true, managerId: true },
    });
    if (!current) return; // dangling parent — not a cycle
  }

  // Past the bound the data is malformed whatever the cause; refusing is the
  // only answer that cannot make it worse.
  throw reject();
}

/** The permission whose disappearance would lock a tenant out of itself. */
export const ADMIN_PERMISSION = 'user.manage';

/** The fields whose self-modification would strip your own access. */
const DANGEROUS_SELF_FIELDS = ['active', 'roleId'] as const;

/**
 * Refuses a caller's attempt to strip their OWN administrative access.
 *
 * Deliberately narrow. Editing your own name or email is harmless and stays
 * allowed; deactivating yourself, deleting yourself, or moving yourself to a
 * weaker role is how an administrator ends up locked out of the system with
 * nobody left who can let them back in.
 *
 * Note this is not a permission check — the caller is *allowed* to manage
 * users. It is a guard against an irreversible mistake.
 */
export function assertNotSelfDangerous(
  actorId: string,
  targetId: string,
  patch: Partial<Record<(typeof DANGEROUS_SELF_FIELDS)[number], unknown>>,
  isDeleting = false,
): void {
  if (actorId !== targetId) return;

  const touchesDangerousField =
    isDeleting || DANGEROUS_SELF_FIELDS.some((f) => patch[f] !== undefined);
  if (!touchesDangerousField) return;

  throw codedConflict(
    'SELF_MUTATION_FORBIDDEN',
    'You cannot deactivate, delete, or change the role of your own account. Ask another administrator to do it.',
  );
}

/** The raw-query surface {@link assertNotLastAdmin} needs from a transaction. */
export interface RawQueryable {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
}

/** Does this role grant the permission that makes a user an administrator? */
async function roleGrantsAdmin(
  tx: RawQueryable,
  roleId: string | null | undefined,
): Promise<boolean> {
  if (!roleId) return false;
  const rows = await tx.$queryRaw<{ roleId: string }[]>`
    SELECT rp."roleId"
    FROM "RolePermission" rp
    JOIN "Permission" p ON p."id" = rp."permissionId"
    WHERE rp."roleId" = ${roleId} AND p."key" = ${ADMIN_PERMISSION}
    LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * Refuses any write that would leave the tenant with zero users able to manage
 * users.
 *
 * MUST be called inside the caller's interactive transaction. The
 * `FOR UPDATE` lock over the surviving-admin candidate set is what makes this
 * safe under concurrency: two administrators removing each other at the same
 * instant would otherwise each read "one other admin remains" and both commit,
 * leaving none. Holding the lock forces them to serialise, so the second sees
 * the first one's effect.
 *
 * `next` describes the state AFTER the proposed write, which is why one
 * function covers deactivation, deletion, and demotion — all three are just
 * different ways of the target ceasing to be an administrator.
 *
 * RLS note: this runs inside `forTenant(...).$transaction`, so `app.tenant_id`
 * is already set and the policies filter "User" and "RolePermission"
 * automatically. "Permission" is a global master table with no RLS by design.
 */
export async function assertNotLastAdmin(
  tx: RawQueryable,
  targetUserId: string,
  next: { roleId?: string | null; active?: boolean; deleting?: boolean },
): Promise<void> {
  // If the target still holds the permission afterwards, nothing is at risk.
  const roleUnchanged = next.roleId === undefined;
  const targetSurvives =
    !next.deleting &&
    next.active !== false &&
    (roleUnchanged || (await roleGrantsAdmin(tx, next.roleId)));
  if (targetSurvives) return;

  // Was the target even an administrator? If not, removing them changes
  // nothing about the tenant's ability to administer itself.
  const targetIsAdmin = await tx.$queryRaw<{ id: string }[]>`
    SELECT u."id"
    FROM "User" u
    JOIN "RolePermission" rp ON rp."roleId" = u."roleId"
    JOIN "Permission" p ON p."id" = rp."permissionId"
    WHERE u."id" = ${targetUserId}
      AND u."active" = true
      AND u."deletedAt" IS NULL
      AND p."key" = ${ADMIN_PERMISSION}
    LIMIT 1
  `;
  if (targetIsAdmin.length === 0) return;

  // Lock every OTHER live administrator for the duration of this transaction.
  const others = await tx.$queryRaw<{ id: string }[]>`
    SELECT u."id"
    FROM "User" u
    JOIN "RolePermission" rp ON rp."roleId" = u."roleId"
    JOIN "Permission" p ON p."id" = rp."permissionId"
    WHERE u."id" <> ${targetUserId}
      AND u."active" = true
      AND u."deletedAt" IS NULL
      AND p."key" = ${ADMIN_PERMISSION}
    FOR UPDATE OF u
  `;

  if (others.length === 0) {
    throw codedConflict(
      'LAST_ADMIN_PROTECTED',
      'This is the last user who can manage users. Give another user a role with the "Manage users" permission first.',
    );
  }
}
