import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PaymentCreate,
  PaymentImport,
  PaymentImportResult,
  PaymentImportRowResult,
  PaymentListQuery,
  PaymentListResponse,
  PaymentRow,
  PaymentUpdate,
  RequestUser,
} from '@greatsales/shared';
import { codedConflict } from '../common/error-codes';
import { PrismaService, type TenantPrisma } from '../prisma/prisma.service';
import { agingDays, deriveStatus, pending } from './payment-engine';
import { normalizeRefNo, planPaymentImport } from './payment-import';

/** Prisma include graph that carries everything a {@link PaymentRow} needs. */
const PAYMENT_INCLUDE = {
  customer: true,
  salesperson: true,
  followups: { orderBy: { date: 'asc' as const } },
} satisfies Prisma.PaymentInclude;

type PaymentWithGraph = Prisma.PaymentGetPayload<{
  include: typeof PAYMENT_INCLUDE;
}>;

function dec(v: Prisma.Decimal | null): number {
  return v == null ? 0 : v.toNumber();
}
function ymd(d: Date | null): string | null {
  return d == null ? null : d.toISOString().slice(0, 10);
}

/** Enrich + derive display values (pending/status/aging) as of `today`. */
function toRow(p: PaymentWithGraph, today: string): PaymentRow {
  const amount = dec(p.amount);
  const received = dec(p.received);
  const dueDate = ymd(p.dueDate);
  return {
    id: p.id,
    refNo: p.refNo,
    customerId: p.customerId,
    customerName: p.customer?.name ?? p.customerName,
    salespersonId: p.salespersonId,
    salespersonName: p.salesperson?.name ?? null,
    invoiceNo: p.invoiceNo,
    invoiceDate: ymd(p.invoiceDate),
    amount,
    received,
    pending: pending(amount, received),
    dueDate,
    agingDays: agingDays(dueDate, today),
    payZone: p.payZone,
    delayReason: p.delayReason,
    nextFollowUp: ymd(p.nextFollowUp),
    mail1: p.mail1,
    mail2: p.mail2,
    mail3: p.mail3,
    mail4: p.mail4,
    status: deriveStatus(amount, received, dueDate, today),
    followups: p.followups.map((f) => ({
      id: f.id,
      date: f.date.toISOString().slice(0, 10),
      note: f.note,
      nextFollowupDate: ymd(f.nextFollowupDate),
    })),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tenant-scoped (RLS) payment list, cursor-paginated, role-scoped for sales. */
  async list(
    user: RequestUser,
    query: PaymentListQuery,
    today: string = new Date().toISOString().slice(0, 10),
  ): Promise<PaymentListResponse> {
    const db = this.prisma.forTenant(user.tenantId);
    const ownerId = await this.resolveOwnerScope(db, user, query.ownerId);

    const rows = await db.payment.findMany({
      where: {
        deletedAt: null,
        ...(ownerId ? { salespersonId: ownerId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.search
          ? {
              OR: [
                { refNo: { contains: query.search, mode: 'insensitive' } },
                { invoiceNo: { contains: query.search, mode: 'insensitive' } },
                {
                  customerName: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      include: PAYMENT_INCLUDE,
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map((p) => toRow(p, today)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /**
   * Create a payment. `customerId`/`salespersonId` are optional (manual
   * entries), but a sales-only caller always owns what they create. The
   * pending/status snapshot is computed from amount/received/dueDate.
   */
  async create(user: RequestUser, body: PaymentCreate): Promise<PaymentRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const salespersonId = (await this.isSalesOnly(db, user.roleId))
      ? user.userId
      : (body.salespersonId ?? null);
    const today = new Date().toISOString().slice(0, 10);
    const received = body.received ?? 0;
    const dueDate = body.dueDate ?? null;

    const created = await db.payment.create({
      data: {
        tenant: { connect: { id: user.tenantId } },
        amount: body.amount,
        received,
        pending: pending(body.amount, received),
        status: deriveStatus(body.amount, received, dueDate, today),
        refNo: normalizeRefNo(body.refNo),
        customerName: body.customerName ?? null,
        invoiceNo: body.invoiceNo ?? null,
        invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        payZone: body.payZone ?? null,
        delayReason: body.delayReason ?? null,
        nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : null,
        ...(body.mail1 !== undefined ? { mail1: body.mail1 } : {}),
        ...(body.mail2 !== undefined ? { mail2: body.mail2 } : {}),
        ...(body.mail3 !== undefined ? { mail3: body.mail3 } : {}),
        ...(body.mail4 !== undefined ? { mail4: body.mail4 } : {}),
        ...(body.customerId
          ? { customer: { connect: { id: body.customerId } } }
          : {}),
        ...(salespersonId
          ? { salesperson: { connect: { id: salespersonId } } }
          : {}),
      },
      include: PAYMENT_INCLUDE,
    });
    return toRow(created, today);
  }

  /**
   * Bulk-import a parsed outstanding-invoice sheet.
   *
   * The browser parses the spreadsheet only to PREVIEW it; this is the
   * authoritative path. Every row is re-validated by the controller's schema,
   * then here:
   *
   *   1. De-dupe against the WHOLE table (all live rows for this tenant), not a
   *      client-loaded page — the pagination gap that let re-imports
   *      double-count. Only the refs present in THIS sheet are queried, so the
   *      read stays index-backed and bounded by sheet size, not ledger size.
   *   2. Insert the survivors inside ONE transaction: a failure cannot leave
   *      half the sheet committed. A repeat reference is a FLAGGED SKIP, not an
   *      error — it is reported and the rest of the sheet still imports.
   *   3. Record an ImportJob either way, OUTSIDE the payment transaction, so the
   *      attempt is audited even when the transaction rolls back.
   *
   * The DB partial-unique index on (tenantId, refNo) is the hard backstop for a
   * reference that races past step 1 (a concurrent import of the same sheet):
   * it aborts the transaction, nothing commits, and the caller re-runs.
   */
  async import(
    user: RequestUser,
    body: PaymentImport,
  ): Promise<PaymentImportResult> {
    const today = new Date().toISOString().slice(0, 10);
    const rows = body.rows;
    const db = this.prisma.forTenant(user.tenantId);

    // A sales-only importer owns every row they bring in (mirrors create()); an
    // admin import carries no salesperson unless the sheet grows one later.
    const salespersonId = (await this.isSalesOnly(db, user.roleId))
      ? user.userId
      : null;

    // Audit the attempt up front. Written through forTenant (its own scoped
    // op), NOT inside the payment transaction: the money insert is the atomic
    // unit; this job row is its ledger and must survive a rollback.
    const job = await db.importJob.create({
      data: {
        tenant: { connect: { id: user.tenantId } },
        type: 'payments',
        status: 'pending',
        total: rows.length,
      },
      select: { id: true },
    });

    try {
      const { results, created, skipped } =
        await this.prisma.transactionForTenant(user.tenantId, async (tx) => {
          const candidateRefs = [
            ...new Set(
              rows
                .map((r) => normalizeRefNo(r.refNo))
                .filter((r): r is string => r !== null),
            ),
          ];
          const existingRows = candidateRefs.length
            ? await tx.payment.findMany({
                where: { refNo: { in: candidateRefs }, deletedAt: null },
                select: { refNo: true },
              })
            : [];
          const existingRefs = existingRows
            .map((p) => p.refNo)
            .filter((r): r is string => r !== null);

          const plan = planPaymentImport(rows, existingRefs);
          const rowResults: PaymentImportRowResult[] = [];
          let createdCount = 0;
          let skippedCount = 0;

          // Insert survivors in source order. A throw here aborts the WHOLE
          // transaction (Postgres marks it aborted on first error), so the
          // import is all-or-nothing — never a half-committed sheet.
          for (let i = 0; i < rows.length; i++) {
            const src = rows[i];
            const decision = plan[i];
            if (decision.action === 'skip') {
              skippedCount++;
              rowResults.push({
                rowNumber: src.rowNumber,
                refNo: decision.refNo,
                status: 'skipped_duplicate',
                message:
                  decision.reason === 'duplicate_existing'
                    ? 'A live payment with this reference already exists — skipped.'
                    : 'This reference is repeated earlier in the sheet — skipped.',
              });
              continue;
            }

            const received = src.received ?? 0;
            const createdRow = await tx.payment.create({
              data: {
                tenantId: user.tenantId,
                amount: src.amount,
                received,
                // Imports carry no due date, so status is Paid/PartiallyPaid/
                // Pending — never Overdue — derived from amount vs. received.
                pending: pending(src.amount, received),
                status: deriveStatus(src.amount, received, null, today),
                refNo: decision.refNo,
                customerName: src.customerName ?? null,
                invoiceDate: src.invoiceDate ? new Date(src.invoiceDate) : null,
                payZone: src.payZone ?? null,
                delayReason: src.delayReason ?? null,
                ...(salespersonId ? { salespersonId } : {}),
              },
              select: { id: true },
            });
            createdCount++;
            rowResults.push({
              rowNumber: src.rowNumber,
              refNo: decision.refNo,
              status: 'created',
              paymentId: createdRow.id,
            });
          }

          return {
            results: rowResults,
            created: createdCount,
            skipped: skippedCount,
          };
        });

      await db.importJob.update({
        where: { id: job.id },
        data: { status: 'completed', errors: [] },
      });

      return {
        importJobId: job.id,
        totalRows: rows.length,
        created,
        skippedDuplicates: skipped,
        failed: 0,
        results,
      };
    } catch (e) {
      // The transaction rolled back — NOTHING was committed. A P2002 is the
      // (tenantId, refNo) backstop firing on a reference that raced past the
      // in-transaction dedupe (a concurrent import of the same sheet).
      const raced =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
      const message = raced
        ? 'A payment reference in this sheet was imported by a concurrent request. Nothing was saved — re-run the import and the duplicate will be skipped.'
        : 'The import failed and was rolled back. No payments were saved.';
      // Record the failure for the audit trail; never let a logging write mask
      // the original error.
      await db.importJob
        .update({
          where: { id: job.id },
          data: { status: 'failed', errors: [{ message }] },
        })
        .catch(() => undefined);
      if (raced) throw codedConflict('PAYMENT_IMPORT_CONFLICT', message);
      throw e;
    }
  }

  /** Partial edit; recomputes the pending/status snapshot from the new figures. */
  async update(
    user: RequestUser,
    id: string,
    patch: PaymentUpdate,
  ): Promise<PaymentRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await this.loadOwned(db, user, id);
    const today = new Date().toISOString().slice(0, 10);

    const data: Prisma.PaymentUpdateInput = {};
    if (patch.amount !== undefined) data.amount = patch.amount;
    if (patch.received !== undefined) data.received = patch.received;
    if ('refNo' in patch) data.refNo = normalizeRefNo(patch.refNo);
    if ('customerName' in patch) data.customerName = patch.customerName ?? null;
    if ('invoiceNo' in patch) data.invoiceNo = patch.invoiceNo ?? null;
    if ('invoiceDate' in patch)
      data.invoiceDate = patch.invoiceDate ? new Date(patch.invoiceDate) : null;
    if ('dueDate' in patch)
      data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
    if ('payZone' in patch) data.payZone = patch.payZone ?? null;
    if ('delayReason' in patch) data.delayReason = patch.delayReason ?? null;
    if ('nextFollowUp' in patch)
      data.nextFollowUp = patch.nextFollowUp
        ? new Date(patch.nextFollowUp)
        : null;
    if (patch.mail1 !== undefined) data.mail1 = patch.mail1;
    if (patch.mail2 !== undefined) data.mail2 = patch.mail2;
    if (patch.mail3 !== undefined) data.mail3 = patch.mail3;
    if (patch.mail4 !== undefined) data.mail4 = patch.mail4;
    if ('customerId' in patch) {
      data.customer = patch.customerId
        ? { connect: { id: patch.customerId } }
        : { disconnect: true };
    }
    if ('salespersonId' in patch) {
      data.salesperson = patch.salespersonId
        ? { connect: { id: patch.salespersonId } }
        : { disconnect: true };
    }

    // Re-snapshot pending/status from the resulting amount/received/dueDate.
    const amount = patch.amount ?? dec(existing.amount);
    const received = patch.received ?? dec(existing.received);
    const dueDate =
      'dueDate' in patch ? (patch.dueDate ?? null) : ymd(existing.dueDate);
    data.pending = pending(amount, received);
    data.status = deriveStatus(amount, received, dueDate, today);

    const updated = await db.payment.update({
      where: { id },
      data,
      include: PAYMENT_INCLUDE,
    });
    return toRow(updated, today);
  }

  /** Soft-delete: set deletedAt so the row drops out of every list. */
  async remove(user: RequestUser, id: string): Promise<void> {
    const db = this.prisma.forTenant(user.tenantId);
    await this.loadOwned(db, user, id);
    await db.payment.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Loads a live payment and enforces sales-only ownership; else throws. */
  private async loadOwned(
    db: TenantPrisma,
    user: RequestUser,
    id: string,
  ): Promise<{
    amount: Prisma.Decimal;
    received: Prisma.Decimal;
    dueDate: Date | null;
  }> {
    const existing = await db.payment.findFirst({
      where: { id, deletedAt: null },
      select: {
        salespersonId: true,
        amount: true,
        received: true,
        dueDate: true,
      },
    });
    if (!existing) throw new NotFoundException('Payment not found');
    if (
      (await this.isSalesOnly(db, user.roleId)) &&
      existing.salespersonId !== user.userId
    ) {
      throw new ForbiddenException('Cannot modify another salesperson payment');
    }
    return existing;
  }

  private async resolveOwnerScope(
    db: TenantPrisma,
    user: RequestUser,
    requestedOwnerId?: string,
  ): Promise<string | undefined> {
    if (await this.isSalesOnly(db, user.roleId)) return user.userId;
    return requestedOwnerId && requestedOwnerId !== 'ALL'
      ? requestedOwnerId
      : undefined;
  }

  private async isSalesOnly(
    db: TenantPrisma,
    roleId: string,
  ): Promise<boolean> {
    const role = await db.role.findUnique({ where: { id: roleId } });
    return role?.name === 'sales';
  }
}
