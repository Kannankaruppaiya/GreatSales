import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type CustomerCategory,
  type PaymentTerms,
} from '@prisma/client';
import {
  PAY_ZONE_VALUES,
  type ImportCustomerRow,
  type ImportCustomers,
  type ImportJobListQuery,
  type ImportJobRow,
  type ImportPayments,
  type ImportRowError,
  type RequestUser,
} from '@greatsales/shared';
import {
  deriveStatus,
  dueDateFor,
  invoiceAgeDays,
  pending,
} from '../payments/payment-engine';
import { businessToday } from '../common/business-day';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

/** The four categories a spreadsheet may name, however it capitalises them. */
const CATEGORIES = ['Platinum', 'Gold', 'Silver', 'Brass'] as const;

/**
 * Payment terms as a person writes them, mapped to the enum.
 *
 * A spreadsheet exported from anywhere says "Credit 30" or "30 days", not
 * `Credit30`, so a bare enum parse would reject almost every real file on a
 * column nobody thinks of as an enum. Anything not listed becomes a row error
 * naming the accepted spellings, rather than being silently dropped — an import
 * that quietly discards a column is worse than one that refuses a row.
 */
const PAYMENT_TERMS: Record<string, PaymentTerms> = {
  immediate: 'Immediate',
  'credit 15': 'Credit15',
  credit15: 'Credit15',
  '15 days': 'Credit15',
  'credit 30': 'Credit30',
  credit30: 'Credit30',
  '30 days': 'Credit30',
  'credit 45': 'Credit45',
  credit45: 'Credit45',
  '45 days': 'Credit45',
  cod: 'CashOnDelivery',
  'cash on delivery': 'CashOnDelivery',
  cashondelivery: 'CashOnDelivery',
  'advance 50%': 'Advance50Balance',
  'advance 50% + balance': 'Advance50Balance',
  advance50balance: 'Advance50Balance',
  advance: 'AdvancePayment',
  'advance payment': 'AdvancePayment',
  '100% advance': 'AdvancePayment',
  advancepayment: 'AdvancePayment',
};

const PAYMENT_TERM_SPELLINGS =
  'Immediate, Credit 15, Credit 30, Credit 45, COD, Advance 50%, Advance';

/**
 * Bulk customer import.
 *
 * The whole design turns on one decision: a job is not all-or-nothing. Four
 * hundred rows out of a real workspace's spreadsheet will contain a handful
 * that are wrong — a blank name, a salesperson who left, a duplicate — and
 * rejecting the file over them is how an import feature stops being used. The
 * good rows land, the bad ones come back with their line number and the reason,
 * and the person fixes those few and imports again.
 *
 * That is also why every row is validated BEFORE anything is written, and why
 * the writes then run in one transaction. Validating as it goes would leave a
 * half-imported file behind on the first bad row, which is the worst of both
 * designs: neither atomic nor complete.
 */
@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeatureFlagsService,
  ) {}

  async list(
    user: RequestUser,
    query: ImportJobListQuery,
  ): Promise<ImportJobRow[]> {
    const db = this.prisma.forTenant(user.tenantId);
    const rows = await db.importJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });
    return rows.map(toRow);
  }

  async importCustomers(
    user: RequestUser,
    body: ImportCustomers,
  ): Promise<ImportJobRow> {
    await this.features.assertEnabled(user.tenantId, 'bulk-import');
    const db = this.prisma.forTenant(user.tenantId);

    // Two lookups instead of two per row. A four-hundred-row file would
    // otherwise issue eight hundred queries to answer questions whose whole
    // answer fits in memory.
    const [people, existing] = await Promise.all([
      db.user.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      }),
      db.customer.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      }),
    ]);
    const personByName = new Map(
      people.map((p) => [p.name.trim().toLowerCase(), p.id]),
    );
    const customerByName = new Map(
      existing.map((c) => [c.name.trim().toLowerCase(), c.id]),
    );

    const errors: ImportRowError[] = [];
    type Parsed = {
      row: ImportCustomerRow;
      category?: CustomerCategory;
      terms?: PaymentTerms;
    };
    const toCreate: (Parsed & { salespersonId: string })[] = [];
    const toUpdate: (Parsed & { id: string })[] = [];
    let skipped = 0;

    // Names repeated INSIDE the file are their own kind of duplicate: the
    // database has not seen them yet, so `customerByName` cannot catch them,
    // and importing both would create two accounts with one name.
    const seenInFile = new Set<string>();

    for (const row of body.rows) {
      const key = row.name.trim().toLowerCase();

      if (seenInFile.has(key)) {
        errors.push({
          line: row.line,
          name: row.name,
          reason: 'This name appears more than once in the file.',
        });
        continue;
      }
      seenInFile.add(key);

      const category = row.category
        ? CATEGORIES.find(
            (c) => c.toLowerCase() === row.category!.trim().toLowerCase(),
          )
        : undefined;
      if (row.category && !category) {
        errors.push({
          line: row.line,
          name: row.name,
          reason: `"${row.category}" is not one of ${CATEGORIES.join(', ')}.`,
        });
        continue;
      }

      const terms = row.paymentTerms
        ? PAYMENT_TERMS[row.paymentTerms.trim().toLowerCase()]
        : undefined;
      if (row.paymentTerms && !terms) {
        errors.push({
          line: row.line,
          name: row.name,
          reason: `"${row.paymentTerms}" is not a payment term. Use one of: ${PAYMENT_TERM_SPELLINGS}.`,
        });
        continue;
      }

      const alreadyThere = customerByName.get(key);
      if (alreadyThere) {
        if (body.onDuplicate === 'skip') {
          skipped++;
          continue;
        }
        toUpdate.push({ row, id: alreadyThere, category, terms });
        continue;
      }

      // A new account needs an owner. The sheet names one, or it falls to
      // whoever is importing — never to nobody, because an unowned customer
      // appears in no salesperson's list and is found only by searching for it.
      const salespersonId = row.salespersonName
        ? personByName.get(row.salespersonName.trim().toLowerCase())
        : user.userId;
      if (!salespersonId) {
        errors.push({
          line: row.line,
          name: row.name,
          reason: `No user in this workspace is called "${row.salespersonName}".`,
        });
        continue;
      }
      toCreate.push({ row, salespersonId, category, terms });
    }

    // One transaction: a file either imported or it did not, and a person
    // re-running a half-written import is how duplicates get made.
    await this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      for (const { row, salespersonId, category, terms } of toCreate) {
        const customer = await tx.customer.create({
          data: {
            tenantId: user.tenantId,
            name: row.name,
            salespersonId,
            area: row.area ?? null,
            category: category ?? null,
            paymentTerms: terms ?? null,
          },
        });
        // `Contact` is polymorphic, so it is written after the customer rather
        // than nested inside it — there is no id to point at until then.
        if (row.contactName || row.phone || row.email) {
          await tx.contact.create({
            data: {
              tenantId: user.tenantId,
              entityType: 'Customer',
              entityId: customer.id,
              name: row.contactName ?? row.name,
              phone: row.phone ?? null,
              whatsapp: row.phone ?? null,
              email: row.email ?? null,
              isPrimary: true,
            },
          });
        }
      }

      for (const { row, id, category, terms } of toUpdate) {
        // Only the columns the sheet carries. A spreadsheet that omits a column
        // must never blank the value already stored — which is why there is no
        // "replace" mode.
        await tx.customer.update({
          where: { id },
          data: {
            ...(row.area != null ? { area: row.area } : {}),
            ...(category ? { category } : {}),
            ...(terms ? { paymentTerms: terms } : {}),
          },
        });
      }
    });

    const job = await db.importJob.create({
      data: {
        tenantId: user.tenantId,
        type: 'customers',
        status: errors.length ? 'completed_with_errors' : 'completed',
        total: body.rows.length,
        created: toCreate.length,
        updated: toUpdate.length,
        skipped,
        errors: errors as unknown as Prisma.InputJsonValue,
        createdById: user.userId,
      },
    });
    return toRow(job);
  }

  /**
   * Bulk receivables import — the same shape as {@link importCustomers}, and
   * for the same reason.
   *
   * The page used to POST one invoice per row in a loop. A Tally export is
   * hundreds of invoices and the API throttles at 120 requests a minute, so a
   * real file was cut off partway through with the ledger half written and no
   * record that it had happened. One request, one transaction, one job row.
   */
  async importPayments(
    user: RequestUser,
    body: ImportPayments,
  ): Promise<ImportJobRow> {
    await this.features.assertEnabled(user.tenantId, 'bulk-import');
    const db = this.prisma.forTenant(user.tenantId);
    const today = businessToday();

    // Two lookups, not two per row.
    const [customers, existing] = await Promise.all([
      db.customer.findMany({
        where: { deletedAt: null },
        // The terms come back with the id: an invoice's due date is its
        // invoice date plus whatever credit THIS customer was granted, and
        // this import used to add a flat 30 days to every row in the ledger
        // without ever asking.
        select: { id: true, name: true, paymentTerms: true },
      }),
      db.payment.findMany({
        where: { deletedAt: null, refNo: { not: null } },
        select: { id: true, refNo: true },
      }),
    ]);
    const customerByName = new Map(
      customers.map((c) => [c.name.trim().toLowerCase(), c.id]),
    );
    const termsByCustomerId = new Map(
      customers.map((c) => [c.id, c.paymentTerms]),
    );
    const paymentByRef = new Map(
      existing.map((p) => [(p.refNo as string).trim().toLowerCase(), p.id]),
    );

    const errors: ImportRowError[] = [];
    type Parsed = {
      line: number;
      refNo: string | null;
      customerName: string;
      customerId: string | null;
      invoiceDate: Date | null;
      amount: number;
      received: number;
      payZone: (typeof PAY_ZONE_VALUES)[number] | null;
      delayReason: string | null;
    };
    const toCreate: Parsed[] = [];
    const toUpdate: (Parsed & { id: string })[] = [];
    let skipped = 0;

    // A reference repeated INSIDE the file is its own kind of duplicate: the
    // ledger has not seen it yet, so the map above cannot catch it.
    const seenInFile = new Set<string>();

    for (const row of body.rows) {
      const ref = row.refNo?.trim() ?? '';
      const key = ref.toLowerCase();

      if (ref && seenInFile.has(key)) {
        errors.push({
          line: row.line,
          name: ref,
          reason: 'This reference appears more than once in the file.',
        });
        continue;
      }
      if (ref) seenInFile.add(key);

      const zone = row.payZone
        ? PAY_ZONE_VALUES.find(
            (z) => z.toLowerCase() === row.payZone!.trim().toLowerCase(),
          )
        : undefined;
      if (row.payZone && !zone) {
        errors.push({
          line: row.line,
          name: ref || row.customerName,
          reason: `Unknown zone "${row.payZone}". Use one of: ${PAY_ZONE_VALUES.join(', ')}.`,
        });
        continue;
      }

      const invoiceDate = row.invoiceDate ? new Date(row.invoiceDate) : null;
      if (invoiceDate && Number.isNaN(invoiceDate.getTime())) {
        errors.push({
          line: row.line,
          name: ref || row.customerName,
          reason: `"${row.invoiceDate}" is not a date the importer can read.`,
        });
        continue;
      }

      const parsed: Parsed = {
        line: row.line,
        refNo: ref || null,
        customerName: row.customerName,
        // Matched by name, and left unlinked when no account matches rather
        // than rejected: an invoice for a party not yet on the master is still
        // money owed, and the row carries the name for a person to reconcile.
        customerId:
          customerByName.get(row.customerName.trim().toLowerCase()) ?? null,
        invoiceDate,
        amount: row.amount,
        received: row.received ?? 0,
        payZone: zone ?? null,
        delayReason: row.delayReason?.trim() || null,
      };

      const already = ref ? paymentByRef.get(key) : undefined;
      if (already) {
        if (body.onDuplicate === 'skip') {
          skipped++;
          continue;
        }
        toUpdate.push({ ...parsed, id: already });
        continue;
      }
      toCreate.push(parsed);
    }

    await this.prisma.transactionForTenant(user.tenantId, async (tx) => {
      for (const r of toCreate) {
        const invoiceDate = r.invoiceDate
          ? r.invoiceDate.toISOString().slice(0, 10)
          : null;
        // The sheet carries no due-date column, so this is derived — from the
        // customer's agreed terms, not from a flat 30 days. A customer with
        // none recorded still falls back to 30, so only rows where a real
        // answer existed and was being ignored change.
        const dueDate = dueDateFor(
          invoiceDate,
          r.customerId ? (termsByCustomerId.get(r.customerId) ?? null) : null,
        );
        await tx.payment.create({
          data: {
            tenantId: user.tenantId,
            refNo: r.refNo,
            customerId: r.customerId,
            customerName: r.customerName,
            invoiceNo: r.refNo,
            invoiceDate: r.invoiceDate,
            dueDate: dueDate ? new Date(dueDate) : null,
            amount: r.amount,
            received: r.received,
            pending: pending(r.amount, r.received),
            // The age of the INVOICE, which is what this column has always
            // been called and never been. It counted from the due date, so
            // every imported row was 30 days younger than its own date said.
            agingDays: invoiceAgeDays(invoiceDate, today),
            payZone: r.payZone,
            delayReason: r.delayReason,
            status: deriveStatus(r.amount, r.received, dueDate, today),
          },
        });
      }

      for (const r of toUpdate) {
        // Only what the sheet carries. A column the export omits must never
        // blank the value already stored.
        await tx.payment.update({
          where: { id: r.id },
          data: {
            amount: r.amount,
            received: r.received,
            pending: pending(r.amount, r.received),
            ...(r.payZone ? { payZone: r.payZone } : {}),
            ...(r.delayReason ? { delayReason: r.delayReason } : {}),
          },
        });
      }
    });

    const job = await db.importJob.create({
      data: {
        tenantId: user.tenantId,
        type: 'payments',
        status: errors.length ? 'completed_with_errors' : 'completed',
        total: body.rows.length,
        created: toCreate.length,
        updated: toUpdate.length,
        skipped,
        errors: errors as unknown as Prisma.InputJsonValue,
        createdById: user.userId,
      },
    });
    return toRow(job);
  }
}

function toRow(j: {
  id: string;
  type: string;
  status: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Prisma.JsonValue;
  createdAt: Date;
}): ImportJobRow {
  return {
    id: j.id,
    type: j.type,
    status: j.status,
    total: j.total,
    created: j.created,
    updated: j.updated,
    skipped: j.skipped,
    errors: Array.isArray(j.errors)
      ? (j.errors as unknown as ImportRowError[])
      : [],
    createdAt: j.createdAt.toISOString(),
  };
}
