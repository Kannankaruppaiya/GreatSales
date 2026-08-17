import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The base Prisma client. Connects as the RLS-bound role `greatsales_app`, so
 * on its own it can see NO tenant rows (policies fail closed when
 * app.tenant_id is unset). Callers must go through {@link forTenant}.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(databaseUrl: string) {
    super({
      datasourceUrl: databaseUrl,
      log:
        process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    // Report the REAL role + RLS posture. A superuser here silently disables
    // tenant isolation, so fail loudly in that case.
    const [{ role, superuser }] = await this.$queryRawUnsafe<
      { role: string; superuser: boolean }[]
    >(
      "SELECT current_user AS role, current_setting('is_superuser')::bool AS superuser",
    );
    if (superuser) {
      // Fail closed: a superuser connection bypasses every RLS policy, so the
      // API would silently serve cross-tenant data. Refuse to start.
      await this.$disconnect();
      throw new Error(
        `FATAL: API connected to Postgres as SUPERUSER "${role}", which BYPASSES RLS. ` +
          `Set DATABASE_URL to the greatsales_app role. Refusing to start.`,
      );
    }
    this.logger.log(`Connected as ${role} (RLS enforced)`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Returns a tenant-scoped client. Every model operation issued through it is
   * wrapped in a transaction whose first statement sets `app.tenant_id`
   * transaction-locally (`set_config(..., true)`), so Postgres RLS filters
   * every read and write to this tenant — the API cannot leak across tenants
   * even if a `where` clause forgets the tenant filter.
   *
   * tenantId is bound as a query parameter (never string-interpolated), so a
   * hostile value cannot break out of the SET.
   *
   * Note: scoping is per-operation. For multi-statement atomicity across
   * several writes, use an explicit interactive `$transaction` that runs the
   * same `set_config` as its first statement.
   */
  forTenant(tenantId: string) {
    const base = this;
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const [, result] = await base.$transaction([
              base.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
              query(args),
            ]);
            return result;
          },
        },
      },
    });
  }
}

/** The tenant-scoped client type, for typing service parameters. */
export type TenantPrisma = ReturnType<PrismaService['forTenant']>;
