import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The PRIVILEGED database client — connects as the OWNER role (DIRECT_URL,
 * `greatsales`), which is a superuser and therefore BYPASSES RLS.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  DANGER. This is the one connection in the API that can see across tenants.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The ordinary {@link PrismaService} connects as the RLS-bound `greatsales_app`
 * role and *refuses to start* if it can bypass RLS — that is the whole tenant
 * isolation model. This client is the deliberate, quarantined exception the
 * platform (owner) surface needs, because:
 *
 *   1. platform tables (`PlatformUser`, `PlatformAuditLog`) are NOT granted to
 *      `greatsales_app` at all — the tenant role gets `permission denied` — and
 *   2. listing every management means reading `Tenant`, which has FORCE ROW
 *      LEVEL SECURITY, so only a bypassing role sees more than one row.
 *
 * Rules for using it, to keep the blast radius contained:
 *   • It lives ONLY in PlatformModule. No tenant-request code path may inject it.
 *   • Use it ONLY for platform tables and deliberate cross-tenant reads/writes.
 *   • For anything scoped to a SINGLE tenant (e.g. reading that tenant's admin
 *     during assume), use PrismaService.forTenant instead, so RLS — not this
 *     code's care — enforces the tenant boundary.
 *
 * ADMIN-CAPABILITIES.md Part B documents this: "Platform Super-Admin … connects
 * as `greatsales` (superuser, RLS bypass)".
 */
@Injectable()
export class PlatformPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PlatformPrismaService.name);

  constructor(databaseUrl: string) {
    super({ datasourceUrl: databaseUrl, log: ['error'] });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    // The inverse of PrismaService's assertion: this connection is USELESS to
    // the platform surface unless it can bypass RLS (FORCE RLS on Tenant would
    // otherwise hide every tenant). Fail loudly if it was pointed at the
    // RLS-bound role by mistake, rather than silently returning zero rows.
    const [{ role, superuser, bypassrls }] = await this.$queryRawUnsafe<
      { role: string; superuser: boolean; bypassrls: boolean }[]
    >(
      `SELECT current_user AS role,
              current_setting('is_superuser')::bool AS superuser,
              COALESCE((SELECT rolbypassrls FROM pg_roles
                        WHERE rolname = current_user), false) AS bypassrls`,
    );
    if (!superuser && !bypassrls) {
      await this.$disconnect();
      throw new Error(
        `FATAL: PlatformPrismaService connected as "${role}", which is NOT a ` +
          `superuser and does NOT have BYPASSRLS. Point DIRECT_URL at the owner ` +
          `role (greatsales) so the platform surface can read across tenants. ` +
          `Refusing to start.`,
      );
    }
    this.logger.log(
      `Platform (owner) connection ready as ${role} (RLS bypass)`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
