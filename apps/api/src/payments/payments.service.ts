import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  REMINDER_ORDINALS,
  REMINDER_STAGES,
  type PaymentCreate,
  type PaymentListQuery,
  type PaymentListResponse,
  type PaymentRow,
  type PaymentSummary,
  type PaymentUpdate,
  type ReminderStage,
  type RequestUser,
} from '@greatsales/shared';
import { PrismaService, type TenantPrisma } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  dueDateFor,
  invoiceAgeDays,
  overdueDays,
  deriveStatus,
  pending,
  reminderSequenceError,
  reminderUpdateError,
  type ReminderFlags,
} from './payment-engine';
import {
  assertOwnerNotTransferred,
  assertParentVisible,
} from '../common/entity-access';
import { businessToday } from '../common/business-day';

/**
 * Marking a reminder sent is the only event on a payment that somebody other
 * than its owner routinely causes. The stage list itself lives in the shared
 * contract so both clients label the letters the same way.
 */
const STAGE_AT = {
  mail1: 'mail1At',
  mail2: 'mail2At',
  mail3: 'mail3At',
  mail4: 'mail4At',
} as const satisfies Record<ReminderStage, keyof Prisma.PaymentUpdateInput>;

/** Prisma include graph that carries everything a {@link PaymentRow} needs. */
const PAYMENT_INCLUDE = {
  // The account comes with ITS owner: a receivable that names no salesperson
  // is chased by whoever holds the customer — see {@link ownerWhere}.
  customer: { include: { salesperson: true } },
  salesperson: true,
  followups: { orderBy: { date: 'asc' as const } },
} satisfies Prisma.PaymentInclude;

/**
 * Who owns a receivable.
 *
 * `Payment.salespersonId` is optional and, on a real ledger, usually empty: an
 * invoice is exported from the accounting system, which has no notion of a
 * sales owner. The Promech import is exactly that — all 141 invoices arrived
 * with the column blank while 140 of them point at a customer who does have an
 * owner. Scoping on the column alone meant a salesperson opened the receivables
 * page and saw nothing at all, the salesperson column read "—" on every row,
 * the aging-by-salesperson report had one line called "Unassigned", and the
 * only control that could have set an owner drew its options from the rows —
 * so nothing could ever be assigned either.
 *
 * The collection follows the account. An explicit owner on the payment still
 * wins where one is set; otherwise the customer's owner answers for it.
 */
function ownerWhere(ownerId: string): Prisma.PaymentWhereInput {
  return {
    OR: [
      { salespersonId: ownerId },
      { salespersonId: null, customer: { salespersonId: ownerId } },
    ],
  };
}

type PaymentWithGraph = Prisma.PaymentGetPayload<{
  include: typeof PAYMENT_INCLUDE;
}>;

function dec(v: Prisma.Decimal | null): number {
  return v == null ? 0 : v.toNumber();
}
function ymd(d: Date | null): string | null {
  return d == null ? null : d.toISOString().slice(0, 10);
}
/** Full ISO instant — a reminder's date and time of day both matter. */
function iso(d: Date | null): string | null {
  return d == null ? null : d.toISOString();
}

/** Enrich + derive display values (pending/status/aging) as of `today`. */
function toRow(p: PaymentWithGraph, today: string): PaymentRow {
  const amount = dec(p.amount);
  const received = dec(p.received);
  const invoiceDate = ymd(p.invoiceDate);
  // Derived from the customer's own credit terms when the invoice does not
  // carry a due date of its own, rather than the flat 30 days every row used
  // to be given regardless of what was agreed with them.
  const dueDate = dueDateFor(
    invoiceDate,
    p.customer?.paymentTerms ?? null,
    ymd(p.dueDate),
  );
  return {
    id: p.id,
    refNo: p.refNo,
    customerId: p.customerId,
    customerName: p.customer?.name ?? p.customerName,
    // Both follow the same rule as the scoping above, so a row the API hands a
    // salesperson cannot come back labelled as somebody else's — or nobody's.
    salespersonId: p.salespersonId ?? p.customer?.salespersonId ?? null,
    salespersonName:
      p.salesperson?.name ?? p.customer?.salesperson?.name ?? null,
    invoiceNo: p.invoiceNo,
    invoiceDate,
    amount,
    received,
    pending: pending(amount, received),
    dueDate,
    agingDays: invoiceAgeDays(invoiceDate, today),
    overdueDays: overdueDays(dueDate, today),
    payZone: p.payZone,
    delayReason: p.delayReason,
    nextFollowUp: ymd(p.nextFollowUp),
    mail1: p.mail1,
    mail2: p.mail2,
    mail3: p.mail3,
    mail4: p.mail4,
    mail1At: iso(p.mail1At),
    mail2At: iso(p.mail2At),
    mail3At: iso(p.mail3At),
    mail4At: iso(p.mail4At),
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Tenant-scoped (RLS) payment list, cursor-paginated, role-scoped for sales. */
  async list(
    user: RequestUser,
    query: PaymentListQuery,
    today: string = businessToday(),
  ): Promise<PaymentListResponse> {
    const db = this.prisma.forTenant(user.tenantId);
    const ownerId = await this.resolveOwnerScope(db, user, query.ownerId);

    // A Payment has no product or principal relation of any kind — it hangs off
    // a Customer and an invoice — so there is deliberately no principalId
    // filter here, and the top bar hides that control on this page.
    const where: Prisma.PaymentWhereInput = {
      deletedAt: null,
      ...(ownerId ? ownerWhere(ownerId) : {}),
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
    };

    const [rows, total] = await db.$transaction([
      db.payment.findMany({
        where,
        include: PAYMENT_INCLUDE,
        orderBy: { id: 'asc' },
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      db.payment.count({ where }),
    ]);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map((p) => toRow(p, today)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      total,
    };
  }

  /**
   * Create a payment. `customerId`/`salespersonId` are optional (manual
   * entries), but a sales-only caller always owns what they create. The
   * pending/status snapshot is computed from amount/received/dueDate.
   */
  /** One invoice, or 404 — including one outside the caller's collection scope. */
  async get(
    user: RequestUser,
    id: string,
    today: string = businessToday(),
  ): Promise<PaymentRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const ownerId = await this.resolveOwnerScope(db, user);
    const row = await db.payment.findFirst({
      where: { id, deletedAt: null, ...(ownerId ? ownerWhere(ownerId) : {}) },
      include: PAYMENT_INCLUDE,
    });
    if (!row) throw new NotFoundException('Payment not found');
    return toRow(row, today);
  }

  /**
   * The caller's receivables rolled up by age and overdue state.
   *
   * Reads the amount columns and dates only, then runs each invoice through
   * the same `toRow` derivation the list uses, so "pending", "overdue" and
   * "age" here are the list's own numbers rather than a second definition.
   * The set is one salesperson's open ledger (or the tenant's for a manager),
   * which the list already pages over; it is not materialised per request
   * anywhere else.
   */
  async summary(
    user: RequestUser,
    ownerIdFilter?: string,
    today: string = businessToday(),
  ): Promise<PaymentSummary> {
    const db = this.prisma.forTenant(user.tenantId);
    const ownerId = await this.resolveOwnerScope(db, user, ownerIdFilter);
    const rows = await db.payment.findMany({
      where: { deletedAt: null, ...(ownerId ? ownerWhere(ownerId) : {}) },
      include: PAYMENT_INCLUDE,
    });
    const open = rows.map((r) => toRow(r, today)).filter((r) => r.pending > 0);

    const buckets: PaymentSummary['aging'] = [
      { bucket: '0-30', amount: 0, count: 0 },
      { bucket: '31-60', amount: 0, count: 0 },
      { bucket: '61-90', amount: 0, count: 0 },
      { bucket: '90+', amount: 0, count: 0 },
    ];
    let overdue = 0;
    let overdueCount = 0;
    let over90Days = 0;
    for (const r of open) {
      const age = r.agingDays ?? 0;
      const slot = age > 90 ? 3 : age > 60 ? 2 : age > 30 ? 1 : 0;
      buckets[slot].amount += r.pending;
      buckets[slot].count += 1;
      if (age > 90) over90Days += r.pending;
      if ((r.overdueDays ?? 0) > 0) {
        overdue += r.pending;
        overdueCount += 1;
      }
    }
    return {
      totalPending: open.reduce((sum, r) => sum + r.pending, 0),
      overdue,
      overdueCount,
      over90Days,
      openCount: open.length,
      aging: buckets,
    };
  }

  async create(user: RequestUser, body: PaymentCreate): Promise<PaymentRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const salespersonId = (await this.isSalesOnly(db, user.roleId))
      ? user.userId
      : (body.salespersonId ?? null);
    const today = businessToday();
    const received = body.received ?? 0;
    const dueDate = body.dueDate ?? null;

    // A record can arrive with letters already behind it — an import, or a
    // collector catching the row up — but not with a gap in them. See
    // `reminderSequenceError`.
    const openingChase = Object.fromEntries(
      REMINDER_STAGES.map((st) => [st, body[st] ?? false]),
    ) as ReminderFlags;
    const gap = reminderSequenceError(openingChase);
    if (gap) throw new BadRequestException(gap);

    const created = await db.payment.create({
      data: {
        tenant: { connect: { id: user.tenantId } },
        amount: body.amount,
        received,
        pending: pending(body.amount, received),
        status: deriveStatus(body.amount, received, dueDate, today),
        refNo: body.refNo ?? null,
        customerName: body.customerName ?? null,
        invoiceNo: body.invoiceNo ?? null,
        invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        payZone: body.payZone ?? null,
        delayReason: body.delayReason ?? null,
        nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : null,
        // A payment can be created with letters already sent (an import, or a
        // collector catching the record up), and those get stamped too.
        ...Object.fromEntries(
          REMINDER_STAGES.filter((st) => body[st] !== undefined).flatMap(
            (st) => [
              [st, body[st]],
              [STAGE_AT[st], body[st] ? new Date() : null],
            ],
          ),
        ),
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

  /** Partial edit; recomputes the pending/status snapshot from the new figures. */
  async update(
    user: RequestUser,
    id: string,
    patch: PaymentUpdate,
  ): Promise<PaymentRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await this.loadOwned(db, user, id);
    const today = businessToday();
    const salesOnly = await this.isSalesOnly(db, user.roleId);

    // Who a receivable belongs to, and which account it sits against, are not
    // fields a salesperson edits. `loadOwned` above proves they own the row
    // TODAY; without this, owning it was enough to hand it to somebody else or
    // move it onto an account that is not theirs — either of which takes an
    // overdue invoice out of their own aging report and off their book. The
    // console never offered it; a direct PATCH did.
    assertOwnerNotTransferred(
      salesOnly,
      user,
      // `null` here means "detach the owner", which is a transfer to nobody.
      'salespersonId' in patch ? (patch.salespersonId ?? null) : undefined,
      'payment',
    );
    if (salesOnly && 'customerId' in patch) {
      if (!patch.customerId) {
        throw new ForbiddenException(
          'Only an administrator can detach a payment from its customer',
        );
      }
      // Their own book only — the same reachability rule remarks and
      // attachments already use, rather than a second implementation of it.
      await assertParentVisible(db, user, 'Customer', patch.customerId);
    }

    // The chase, before any of it is written. Both rules live in the engine so
    // the console's menu and the API cannot disagree about what a valid
    // sequence is.
    const currentChase = Object.fromEntries(
      REMINDER_STAGES.map((st) => [st, existing[st]]),
    ) as ReminderFlags;
    const nextChase = Object.fromEntries(
      REMINDER_STAGES.map((st) => [st, patch[st] ?? existing[st]]),
    ) as ReminderFlags;
    const chaseProblem = reminderUpdateError(currentChase, nextChase);
    if (chaseProblem) throw new BadRequestException(chaseProblem);

    const data: Prisma.PaymentUpdateInput = {};
    if (patch.amount !== undefined) data.amount = patch.amount;
    if (patch.received !== undefined) data.received = patch.received;
    if ('refNo' in patch) data.refNo = patch.refNo ?? null;
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
    // A reminder's timestamp is never sent by a client — it is stamped here
    // when the flag beside it flips. A patch repeating `mail2: true` is not a
    // second letter and must not move the date; undoing one clears it, because
    // a date on an unsent letter is worse than no date at all.
    for (const st of REMINDER_STAGES) {
      const next = patch[st];
      if (next === undefined || next === existing[st]) continue;
      data[st] = next;
      data[STAGE_AT[st]] = next ? new Date() : null;
    }
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

    // Which reminder stage was just marked sent, if any. The collector is the
    // one chasing this invoice, so they are the one who needs to know that
    // somebody else already sent the letter.
    const sentStage = REMINDER_STAGES.find(
      (stage) => patch[stage] === true && existing[stage] === false,
    );
    const ordinal = sentStage
      ? REMINDER_ORDINALS[REMINDER_STAGES.indexOf(sentStage)]
      : null;
    // A manual payment need not have an owner; then there is nobody to tell.
    if (sentStage && updated.salespersonId) {
      await this.notifications.notify({
        tenantId: user.tenantId,
        userId: updated.salespersonId,
        actorId: user.userId,
        type: 'PaymentReminder',
        // "MAIL2 sent" named a database column at a person. They send letters.
        title: `${ordinal} reminder sent for ${updated.invoiceNo ?? 'an invoice'}`,
        body: updated.customer?.name ?? updated.customerName,
        entityType: 'Payment',
        entityId: updated.id,
      });
    }

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
    mail1: boolean;
    mail2: boolean;
    mail3: boolean;
    mail4: boolean;
  }> {
    const existing = await db.payment.findFirst({
      where: { id, deletedAt: null },
      select: {
        salespersonId: true,
        // The account's owner, for the same reason the list scopes on it: the
        // salesperson chasing an invoice is usually named on the customer
        // rather than on the invoice.
        customer: { select: { salespersonId: true } },
        amount: true,
        received: true,
        dueDate: true,
        // The four reminder flags come along so `update` can tell a letter
        // that was just marked sent from one that was already sent — a patch
        // repeating `mail2: true` is not an event.
        mail1: true,
        mail2: true,
        mail3: true,
        mail4: true,
      },
    });
    if (!existing) throw new NotFoundException('Payment not found');
    const owner =
      existing.salespersonId ?? existing.customer?.salespersonId ?? null;
    if ((await this.isSalesOnly(db, user.roleId)) && owner !== user.userId) {
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
