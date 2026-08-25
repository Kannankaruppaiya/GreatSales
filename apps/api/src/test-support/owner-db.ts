import { PrismaClient, type TenantStatus } from '@prisma/client';

/**
 * Fixture setup that legitimately needs OWNER privileges.
 *
 * `Tenant`, `Industry` and `Permission` are not tenant-scoped, so RLS cannot
 * protect them; they are protected by REVOKE instead — the runtime role
 * `greatsales_app` may read them and nothing more. A tenant being able to flip
 * its OWN `status` from Suspended back to Active is precisely the escalation
 * that revoke exists to stop.
 *
 * The auth suite still needs to suspend a tenant to prove login refuses it. It
 * used `prisma.forTenant(...).tenant.update(...)`, i.e. the app role — which
 * worked only because the grant was too wide, and broke the moment it was
 * narrowed. That is the right outcome: a test must not be the reason a
 * production capability stays open.
 *
 * So privileged setup goes through the OWNER connection, exactly as the seed
 * does. Kept deliberately narrow — a single named operation rather than an
 * owner client handed to any test that wants one, because an owner client
 * bypasses every RLS policy and would make an isolation test pass for the
 * wrong reason.
 */

/** Owner connection, opened lazily and reused across a suite. */
let owner: PrismaClient | null = null;

function ownerClient(): PrismaClient {
  if (!owner) {
    const url = process.env.DIRECT_URL;
    if (!url) {
      throw new Error(
        'DIRECT_URL is not set. Privileged fixture setup needs the OWNER ' +
          'connection — copy apps/api/.env.test.example to apps/api/.env.test.',
      );
    }
    owner = new PrismaClient({ datasourceUrl: url });
  }
  return owner;
}

/** Sets a tenant's lifecycle status. Owner-only; not reachable from the API. */
export async function setTenantStatus(
  tenantId: string,
  status: TenantStatus,
): Promise<void> {
  await ownerClient().tenant.update({
    where: { id: tenantId },
    data: { status },
  });
}

/** Soft-deletes or restores a tenant. Owner-only; not reachable from the API. */
export async function setTenantDeletedAt(
  tenantId: string,
  deletedAt: Date | null,
): Promise<void> {
  await ownerClient().tenant.update({
    where: { id: tenantId },
    data: { deletedAt },
  });
}

/** Releases the owner connection. Call from a suite's afterAll. */
export async function disconnectOwnerDb(): Promise<void> {
  await owner?.$disconnect();
  owner = null;
}
