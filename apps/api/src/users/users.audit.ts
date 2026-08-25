import type { RequestUser } from '@greatsales/shared';

/**
 * Audit-trail construction for user administration (AGENTS.md §25).
 *
 * Every one of these actions changes who can do what in a workspace, so
 * "who changed this, when, from what, to what" must be answerable afterwards.
 */
export type UserAuditAction =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.restored'
  | 'user.password_reset';

/**
 * Strips anything credential-shaped before it reaches an audit row.
 *
 * Deliberately a KEY-NAME filter rather than an allow-list of known-safe
 * fields: a column added later and called `tempPassword`, `resetToken`, or
 * `apiSecret` is caught automatically, instead of leaking into the audit log
 * until somebody happens to notice.
 *
 * Dates are serialised here so the stored JSON is comparable across reads
 * rather than depending on Prisma's Json coercion.
 */
export function redactUser(row: unknown): Record<string, unknown> | undefined {
  if (!row || typeof row !== 'object') return undefined;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (/password|secret|token|hash/i.test(key)) continue;
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

/** The minimal write surface {@link auditUser} needs from a transaction. */
export interface AuditWritable {
  auditLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/**
 * Writes one audit row.
 *
 * Takes the TRANSACTION client, never the service's own, so the audit and the
 * change it describes commit or roll back together. §25 is unsatisfiable in
 * either direction otherwise: a rolled-back write could leave an audit row
 * claiming it happened, and a crash after the write could leave a real change
 * with no trace of who made it.
 */
export async function auditUser(
  tx: AuditWritable,
  actor: RequestUser,
  action: UserAuditAction,
  entityId: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      userId: actor.userId,
      action,
      entity: 'User',
      entityId,
      before: redactUser(before),
      after: redactUser(after),
    },
  });
}

/**
 * Why a session ended, stored on each revoked RefreshToken row so an operator
 * can tell a deactivation from a password reset months later.
 */
export function revocationReason(patch: {
  active?: boolean;
  password?: string;
  roleId?: string;
}): string {
  if (patch.active === false) return 'admin_deactivated';
  if (patch.password !== undefined) return 'admin_password_reset';
  return 'role_changed';
}
