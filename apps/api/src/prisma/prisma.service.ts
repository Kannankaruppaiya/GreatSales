import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

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
    // Report the REAL role + RLS posture. There are TWO independent ways a
    // connection can ignore every RLS policy, and checking only the first
    // leaves the second wide open:
    //
    //   1. the role is a SUPERUSER, or
    //   2. the role carries the BYPASSRLS attribute (`rolbypassrls`), which a
    //      well-meaning `ALTER ROLE greatsales_app BYPASSRLS` can grant to a
    //      perfectly ordinary, non-superuser role.
    //
    // Either one silently turns a multi-tenant database into a single-tenant
    // one, so both are fatal.
    const [{ role, superuser, bypassrls }] = await this.$queryRawUnsafe<
      { role: string; superuser: boolean; bypassrls: boolean }[]
    >(
      `SELECT current_user AS role,
              current_setting('is_superuser')::bool AS superuser,
              COALESCE((SELECT rolbypassrls FROM pg_roles
                        WHERE rolname = current_user), false) AS bypassrls`,
    );
    if (superuser || bypassrls) {
      // Fail closed: such a connection bypasses every RLS policy, so the API
      // would silently serve cross-tenant data. Refuse to start.
      const reason = superuser ? 'a SUPERUSER' : 'a role with BYPASSRLS';
      await this.$disconnect();
      throw new Error(
        `FATAL: API connected to Postgres as "${role}", which is ${reason} and ` +
          `therefore BYPASSES RLS. Set DATABASE_URL to the greatsales_app role ` +
          `and ensure it has NOBYPASSRLS. Refusing to start.`,
      );
    }
    this.logger.log(`Connected as ${role} (not superuser, NOBYPASSRLS)`);
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
    return this.$extends({
      query: {
        $allModels: {
          // An ARROW function, deliberately. Written as a method shorthand,
          // `this` would rebind to the extension object — which is why this
          // used to alias the service into a local `base`. The arrow captures
          // the service's `this` lexically, so no alias is needed.
          $allOperations: async ({ args, query }) => {
            const [, result] = await this.$transaction([
              this
                .$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
              query(args),
            ]);
            return result;
          },
        },
      },
    });
  }

  /**
   * Runs `fn` inside ONE interactive transaction that is tenant-scoped from
   * its first statement.
   *
   * {@link forTenant} scopes each MODEL operation individually, by wrapping it
   * in its own transaction. That is correct for single writes but has two
   * consequences a multi-statement guard must not fall into:
   *
   *   1. Separate operations are separate transactions, so a check and the
   *      write it guards are not atomic.
   *   2. The extension hooks `$allModels`, which does NOT cover client-level
   *      raw queries. A `$queryRaw` issued through a tenant client therefore
   *      runs with `app.tenant_id` UNSET, and RLS answers with zero rows —
   *      silently, and in the case of a "does another admin exist?" check,
   *      fail-OPEN.
   *
   * Use this whenever a unit of work spans more than one statement, or uses
   * `$queryRaw` at all. The tenantId is bound as a parameter, never
   * interpolated.
   */
  async transactionForTenant<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    });
  }
}

/** The tenant-scoped client type, for typing service parameters. */
export type TenantPrisma = ReturnType<PrismaService['forTenant']>;

/**
 * The client handed to {@link PrismaService.transactionForTenant}. Guards and
 * audit helpers take THIS type, so they can only be called from inside a
 * tenant-scoped transaction — which is what makes their locking meaningful.
 */
export type TenantTx = Prisma.TransactionClient;
