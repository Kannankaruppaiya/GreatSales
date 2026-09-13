import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { ForbiddenException } from '@nestjs/common';
import type { ImportCustomerRow, RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ImportsService } from './imports.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

/**
 * Bulk customer import.
 *
 * The property under test throughout is that a bad row does not cost the file.
 * Every real spreadsheet has a few — a category spelled differently, a
 * salesperson who has left, the same company twice — and an import that
 * refuses the whole thing over them is one people go back to typing instead of.
 * So each test mixes good rows with one bad kind and asserts both halves: the
 * good rows are in the database, and the bad one came back with its line number
 * and a reason somebody can act on.
 */
const ACME = 'tenant_acme';
const admin: RequestUser = {
  userId: 'user_admin_acme',
  tenantId: ACME,
  roleId: 'role_admin_acme',
};

let line = 0;
const row = (over: Partial<ImportCustomerRow> = {}): ImportCustomerRow => ({
  line: ++line,
  name: `Imported ${line}`,
  ...over,
});

describe('ImportsService (integration)', () => {
  let prisma: PrismaService;
  let imports: ImportsService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    imports = new ImportsService(prisma, new FeatureFlagsService(prisma));
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('imports a clean file and says what it did', async () => {
    const job = await imports.importCustomers(admin, {
      rows: [
        row({ name: 'Clean Alpha Ltd', area: 'North', category: 'Gold' }),
        row({ name: 'Clean Beta Ltd', paymentTerms: 'Credit 30' }),
      ],
      onDuplicate: 'skip',
    });

    expect(job).toMatchObject({
      type: 'customers',
      status: 'completed',
      total: 2,
      created: 2,
      updated: 0,
      skipped: 0,
      errors: [],
    });

    const stored = await prisma
      .forTenant(ACME)
      .customer.findFirst({ where: { name: 'Clean Beta Ltd' } });
    // "Credit 30" is what a spreadsheet says; Credit30 is what the column
    // holds. A bare enum parse would have refused this row.
    expect(stored?.paymentTerms).toBe('Credit30');
  });

  it('lands the good rows and reports only the bad one', async () => {
    const bad = row({ name: 'Bad Category Ltd', category: 'Diamond' });
    const job = await imports.importCustomers(admin, {
      rows: [row({ name: 'Good With Bad Ltd' }), bad],
      onDuplicate: 'skip',
    });

    expect(job.created).toBe(1);
    expect(job.status).toBe('completed_with_errors');
    expect(job.errors).toEqual([
      {
        line: bad.line,
        name: 'Bad Category Ltd',
        reason: expect.stringContaining('Platinum'),
      },
    ]);

    const good = await prisma
      .forTenant(ACME)
      .customer.findFirst({ where: { name: 'Good With Bad Ltd' } });
    expect(good).not.toBeNull();
  });

  it('refuses a row whose salesperson is not in the workspace', async () => {
    const job = await imports.importCustomers(admin, {
      rows: [
        row({ name: 'Ghost Owner Ltd', salespersonName: 'Nobody At All' }),
      ],
      onDuplicate: 'skip',
    });
    expect(job.created).toBe(0);
    expect(job.errors[0].reason).toContain('Nobody At All');
  });

  it('gives a row with no named salesperson to whoever ran the import', async () => {
    // Never nobody: an unowned account appears in no salesperson's list and is
    // found only by searching for it.
    await imports.importCustomers(admin, {
      rows: [row({ name: 'Unowned Ltd' })],
      onDuplicate: 'skip',
    });
    const stored = await prisma
      .forTenant(ACME)
      .customer.findFirst({ where: { name: 'Unowned Ltd' } });
    expect(stored?.salespersonId).toBe(admin.userId);
  });

  it('catches a name repeated inside the same file', async () => {
    const second = row({ name: 'Twice In File Ltd' });
    const job = await imports.importCustomers(admin, {
      rows: [row({ name: 'Twice In File Ltd' }), second],
      onDuplicate: 'skip',
    });
    // The database has not seen the first one yet when the second is read, so
    // this cannot be caught by looking at existing customers.
    expect(job.created).toBe(1);
    expect(job.errors[0].line).toBe(second.line);
  });

  it('skips an existing account by default', async () => {
    await imports.importCustomers(admin, {
      rows: [row({ name: 'Already Here Ltd', area: 'South' })],
      onDuplicate: 'skip',
    });
    const job = await imports.importCustomers(admin, {
      rows: [row({ name: 'Already Here Ltd', area: 'West' })],
      onDuplicate: 'skip',
    });

    expect(job).toMatchObject({ created: 0, skipped: 1, errors: [] });
    const stored = await prisma
      .forTenant(ACME)
      .customer.findFirst({ where: { name: 'Already Here Ltd' } });
    expect(stored?.area).toBe('South');
  });

  it('updates only the columns the sheet carries', async () => {
    await imports.importCustomers(admin, {
      rows: [
        row({ name: 'Partial Update Ltd', area: 'East', category: 'Gold' }),
      ],
      onDuplicate: 'skip',
    });

    const job = await imports.importCustomers(admin, {
      rows: [row({ name: 'Partial Update Ltd', area: 'North' })],
      onDuplicate: 'update',
    });
    expect(job).toMatchObject({ created: 0, updated: 1 });

    const stored = await prisma
      .forTenant(ACME)
      .customer.findFirst({ where: { name: 'Partial Update Ltd' } });
    expect(stored?.area).toBe('North');
    // A sheet that omits a column must never blank the value already there —
    // which is why there is no "replace" mode.
    expect(stored?.category).toBe('Gold');
  });

  it('records the run so the answer survives the tab closing', async () => {
    const history = await imports.list(admin, { limit: 10 });
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].createdAt).toBeTruthy();
    // Newest first.
    expect(new Date(history[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(history[history.length - 1].createdAt).getTime(),
    );
  });

  it('refuses to import for a workspace without the feature', async () => {
    // Globex is seeded with customer-location off; bulk-import is at 50% and
    // this asserts whichever side Globex lands on is actually enforced.
    const globexAdmin: RequestUser = {
      userId: 'user_admin_globex',
      tenantId: 'tenant_globex',
      roleId: 'role_admin_globex',
    };
    const features = new FeatureFlagsService(prisma);
    const allowed = await features.isEnabled('tenant_globex', 'bulk-import');

    if (allowed) {
      await expect(
        imports.importCustomers(globexAdmin, {
          rows: [row({ name: 'Globex Import Ltd' })],
          onDuplicate: 'skip',
        }),
      ).resolves.toMatchObject({ created: 1 });
    } else {
      await expect(
        imports.importCustomers(globexAdmin, {
          rows: [row({ name: 'Globex Import Ltd' })],
          onDuplicate: 'skip',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  describe('receivables', () => {
    /**
     * The whole reason this endpoint exists: the page used to POST one invoice
     * per row in a loop, and the API throttles at 120 requests a minute — so a
     * real Tally export was cut off partway with the ledger half written. One
     * request, one transaction.
     */
    const invoice = (over: Record<string, unknown> = {}) => ({
      line: 2,
      refNo: 'IMP-001',
      customerName: 'Acme Corp Customer One',
      invoiceDate: '2026-09-01',
      amount: 5000,
      received: 1000,
      payZone: 'RedZone',
      delayReason: null,
      ...over,
    });

    it('takes a file bigger than the per-minute request limit in one call', async () => {
      const rows = Array.from({ length: 150 }, (_, i) =>
        invoice({ line: i + 2, refNo: `IMP-BULK-${i}` }),
      );
      const job = await imports.importPayments(admin, {
        rows,
        onDuplicate: 'skip',
      });
      expect(job.type).toBe('payments');
      expect(job.created).toBe(150);
      expect(job.status).toBe('completed');
    });

    it('links each invoice to the account it names, so it inherits an owner', async () => {
      await imports.importPayments(admin, {
        rows: [invoice({ refNo: 'IMP-LINKED' })],
        onDuplicate: 'skip',
      });
      const row = await prisma
        .forTenant('tenant_acme')
        .payment.findFirst({ where: { refNo: 'IMP-LINKED' } });
      expect(row?.customerId).toBe('cust_1_acme');
      // Derived, not taken from the sheet: the sheet has neither.
      expect(row?.pending?.toString()).toBe('4000');
      expect(row?.dueDate).not.toBeNull();
    });

    it('skips a reference the ledger already holds rather than duplicating it', async () => {
      const first = await imports.importPayments(admin, {
        rows: [invoice({ refNo: 'IMP-DUP' })],
        onDuplicate: 'skip',
      });
      expect(first.created).toBe(1);
      const again = await imports.importPayments(admin, {
        rows: [invoice({ refNo: 'IMP-DUP', amount: 9999 })],
        onDuplicate: 'skip',
      });
      expect(again.created).toBe(0);
      expect(again.skipped).toBe(1);
    });

    it('returns a bad row with its line and reason instead of refusing the file', async () => {
      const job = await imports.importPayments(admin, {
        rows: [
          invoice({ line: 2, refNo: 'IMP-GOOD' }),
          invoice({ line: 3, refNo: 'IMP-BADZONE', payZone: 'PurpleZone' }),
        ],
        onDuplicate: 'skip',
      });
      expect(job.created).toBe(1);
      expect(job.status).toBe('completed_with_errors');
      expect(job.errors).toHaveLength(1);
      expect(job.errors[0].line).toBe(3);
      expect(job.errors[0].reason).toContain('PurpleZone');
    });

    it('records the run, so the history says what happened', async () => {
      await imports.importPayments(admin, {
        rows: [invoice({ refNo: 'IMP-HISTORY' })],
        onDuplicate: 'skip',
      });
      const jobs = await imports.list(admin, { limit: 10 });
      expect(jobs.some((j) => j.type === 'payments')).toBe(true);
    });
  });
});
