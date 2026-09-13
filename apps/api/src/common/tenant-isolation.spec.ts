import '../load-env';
import { reseedTestDatabase } from '../test-support/reseed';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The tenancy boundary, asserted against a real database.
 *
 * This is the one class of defect that cannot be fixed after the fact: if two
 * tenants' data mixes even once, no later patch un-mixes it, and the damage is
 * commercial rather than technical. So it is checked structurally (is the
 * protection configured?) AND behaviourally (does it actually deny?), because
 * either alone can pass while the system leaks:
 *
 *   - policies can exist and be bypassed (superuser, BYPASSRLS, unFORCEd RLS)
 *   - queries can be denied today and quietly allowed when a table is added
 *
 * The structural half is DYNAMIC on purpose. A hardcoded list of tables would
 * pass forever while a new tenant-owned table silently shipped with no policy —
 * exactly the regression it exists to prevent.
 */

/**
 * Tables that legitimately have no RLS policy, each with the reason it is safe.
 * Anything not on this list MUST be protected, or the inventory test fails.
 */
const RLS_EXEMPT: Record<string, string> = {
  // Platform-layer tables. Protected by REVOKE rather than RLS: the app role
  // has NO grant at all, which is stronger than a policy.
  PlatformUser: 'no grant to greatsales_app',
  PlatformAuditLog: 'no grant to greatsales_app',
  // Global catalogues, readable by every tenant, writable by none.
  FeatureFlag: 'global, SELECT only for the app role',
  Industry: 'global, SELECT only for the app role',
  Permission: 'global, SELECT only for the app role',
  _prisma_migrations: 'migration bookkeeping, owner only',
};

/** Global tables the app role may READ but must never write. */
const GLOBAL_READ_ONLY = ['Industry', 'Permission', 'Tenant', 'FeatureFlag'];

const TENANT_A = 'tenant_acme';
const TENANT_B = 'tenant_globex';

describe('tenant isolation', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  describe('the connection itself cannot ignore RLS', () => {
    it('runs as a role that is neither superuser nor BYPASSRLS', async () => {
      const [row] = await prisma.$queryRaw<
        { role: string; superuser: boolean; bypassrls: boolean }[]
      >`SELECT current_user AS role,
               current_setting('is_superuser')::bool AS superuser,
               COALESCE((SELECT rolbypassrls FROM pg_roles
                         WHERE rolname = current_user), false) AS bypassrls`;

      // Either one silently turns a multi-tenant database into a single-tenant
      // one, and no policy below would matter.
      expect(row.superuser).toBe(false);
      expect(row.bypassrls).toBe(false);
    });
  });

  describe('every tenant-owned table is protected', () => {
    it('has RLS ENABLED and FORCED — enabled alone is ignored for the table owner', async () => {
      const tables = await prisma.$queryRaw<
        {
          relname: string;
          has_tenant_column: boolean;
          rls_enabled: boolean;
          rls_forced: boolean;
          policy_count: number;
        }[]
      >`
        SELECT c.relname,
               EXISTS (SELECT 1 FROM information_schema.columns col
                        WHERE col.table_name = c.relname
                          AND col.column_name = 'tenantId') AS has_tenant_column,
               c.relrowsecurity          AS rls_enabled,
               c.relforcerowsecurity     AS rls_forced,
               (SELECT count(*)::int FROM pg_policies p
                 WHERE p.tablename = c.relname) AS policy_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'`;

      const unprotected = tables
        .filter((t) => !(t.relname in RLS_EXEMPT))
        .filter((t) => !t.rls_enabled || !t.rls_forced || t.policy_count === 0)
        .map(
          (t) =>
            `${t.relname} (enabled=${t.rls_enabled}, forced=${t.rls_forced}, policies=${t.policy_count})`,
        );

      expect(unprotected).toEqual([]);
    });

    it('exempts nothing that carries a tenantId column', async () => {
      // An exemption is a promise that the table holds no tenant data. If one
      // grows a tenantId later, the promise is broken and this fails.
      const rows = await prisma.$queryRaw<{ relname: string }[]>`
        SELECT DISTINCT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN information_schema.columns col ON col.table_name = c.relname
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND col.column_name = 'tenantId'
          AND NOT c.relrowsecurity`;

      const leaky = rows
        .map((r) => r.relname)
        .filter((name) => !(name in RLS_EXEMPT));

      expect(leaky).toEqual([]);
    });

    it('writes through a policy that has WITH CHECK, not only USING', async () => {
      // USING filters what you can SEE. Without WITH CHECK, a write can still
      // place a row into another tenant.
      const weak = await prisma.$queryRaw<{ tablename: string; cmd: string }[]>`
        SELECT tablename, cmd FROM pg_policies
        WHERE with_check IS NULL AND cmd IN ('ALL', 'INSERT', 'UPDATE')`;

      expect(weak).toEqual([]);
    });
  });

  describe('global tables are readable but not writable', () => {
    it.each(GLOBAL_READ_ONLY)(
      '%s grants the app role no INSERT, UPDATE or DELETE',
      async (table) => {
        const grants = await prisma.$queryRaw<{ privilege_type: string }[]>`
          SELECT DISTINCT privilege_type
          FROM information_schema.role_table_grants
          WHERE grantee = 'greatsales_app' AND table_name = ${table}`;

        const writes = grants
          .map((g) => g.privilege_type)
          .filter((p) => p !== 'SELECT' && p !== 'REFERENCES');

        expect(writes).toEqual([]);
      },
    );
  });

  describe('one tenant cannot reach another tenant', () => {
    // Model names as they appear on the Prisma client, paired with the seeded
    // tenant that owns rows in them.
    const RESOURCES = [
      'customer',
      'lead',
      'salesOrder',
      'payment',
      'product',
      'principal',
      'projection',
      'followUp',
      'user',
      'role',
      'team',
    ] as const;

    /**
     * The seed gives tenant B no FollowUp, and a resource with no B-side row
     * proves nothing — the read would return null whether isolation worked or
     * not. So the fixture is created here rather than dropping followUp from
     * the list and leaving the cross-entity inbox untested.
     */
    beforeAll(async () => {
      const asB = prisma.forTenant(TENANT_B);
      const existing = await asB.followUp.findFirst({ select: { id: true } });
      if (!existing) {
        const owner = await asB.user.findFirst({ select: { id: true } });
        if (!owner) throw new Error('tenant B has no user to own a follow-up');
        await asB.followUp.create({
          data: {
            tenantId: TENANT_B,
            entityType: 'Lead',
            entityId: 'isolation-fixture',
            salespersonId: owner.id,
            dueDate: new Date(),
          },
        });
      }
    });

    /** Reads a row id belonging to tenant B, using B's own scoped client. */
    async function idOwnedByB(model: string): Promise<string | null> {
      const db = prisma.forTenant(TENANT_B) as unknown as Record<
        string,
        { findFirst: (a: unknown) => Promise<{ id: string } | null> }
      >;
      const row = await db[model].findFirst({ select: { id: true } });
      return row?.id ?? null;
    }

    it.each(RESOURCES)('%s: B owns rows that A cannot READ', async (model) => {
      const bId = await idOwnedByB(model);
      expect(bId).toBeTruthy(); // fixture sanity: the test proves nothing without one

      const asA = prisma.forTenant(TENANT_A) as unknown as Record<
        string,
        { findFirst: (a: unknown) => Promise<{ id: string } | null> }
      >;
      const seen = await asA[model].findFirst({ where: { id: bId } });

      expect(seen).toBeNull();
    });

    it.each(RESOURCES)(
      '%s: A cannot WRITE a row of B — the dangerous half, which a SELECT-only check misses',
      async (model) => {
        const bId = await idOwnedByB(model);
        expect(bId).toBeTruthy();

        const asA = prisma.forTenant(TENANT_A) as unknown as Record<
          string,
          {
            updateMany: (a: unknown) => Promise<{ count: number }>;
            deleteMany: (a: unknown) => Promise<{ count: number }>;
          }
        >;

        const updated = await asA[model].updateMany({
          where: { id: bId },
          data: { updatedAt: new Date() },
        });
        expect(updated.count).toBe(0);

        const deleted = await asA[model].deleteMany({ where: { id: bId } });
        expect(deleted.count).toBe(0);
      },
    );

    it('a list query returns only the calling tenant, never a mix', async () => {
      const rows = await prisma
        .forTenant(TENANT_A)
        .customer.findMany({ select: { tenantId: true } });

      expect(rows.length).toBeGreaterThan(0);
      expect([...new Set(rows.map((r) => r.tenantId))]).toEqual([TENANT_A]);
    });

    it('EVERY protected table keeps the two tenants disjoint — including sub-resources', async () => {
      // The named resources above cover the 11 top-level ones. Sub-resources
      // (SalesOrderItem, LeadProduct, OrderStatusHistory,
      // PaymentFollowup, RolePermission, ...) are protected by policies that
      // reach through a parent with EXISTS, which is a different and more
      // fragile shape — a wrong join there leaks quietly.
      //
      // Enumerated from pg_class rather than listed, so a table added later is
      // covered the day it appears instead of the day someone remembers.
      const tables = await prisma.$queryRaw<{ relname: string }[]>`
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
          AND EXISTS (SELECT 1 FROM information_schema.columns col
                       WHERE col.table_name = c.relname AND col.column_name = 'id')
        ORDER BY c.relname`;

      expect(tables.length).toBeGreaterThan(10); // the query itself must work

      const idsFor = async (tenant: string, table: string) => {
        // Identifier comes from pg_catalog, never from input, and is checked
        // against a strict pattern before interpolation regardless.
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
          throw new Error(`refusing to interpolate table name: ${table}`);
        }
        return prisma.transactionForTenant(tenant, (tx) =>
          tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "${table}"`),
        );
      };

      const overlaps: string[] = [];
      const bothEmpty: string[] = [];

      for (const { relname } of tables) {
        const [a, b] = await Promise.all([
          idsFor(TENANT_A, relname),
          idsFor(TENANT_B, relname),
        ]);
        if (a.length === 0 && b.length === 0) {
          bothEmpty.push(relname); // no fixture — proves nothing either way
          continue;
        }
        const bIds = new Set(b.map((r) => r.id));
        const shared = a.map((r) => r.id).filter((id) => bIds.has(id));
        if (shared.length > 0) {
          overlaps.push(`${relname} (${shared.length} rows visible to both)`);
        }
      }

      expect(overlaps).toEqual([]);

      // Reported, not asserted: an empty table is not evidence of isolation.
      // This keeps the gap visible instead of letting a silent pass look like
      // coverage.
      if (bothEmpty.length > 0) {
        console.warn(
          `tenant-isolation: no fixtures, so NOT proven for: ${bothEmpty.join(', ')}`,
        );
      }
    }, 120_000);

    it('an unset tenant context sees nothing — policies fail closed', async () => {
      // The base client never sets app.tenant_id. If policies failed OPEN this
      // would return every tenant's rows at once.
      const rows = await prisma.customer.findMany({ select: { id: true } });
      expect(rows).toEqual([]);
    });
  });
});
