import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { NotificationsService } from '../notifications/notifications.service';

const admin = (tid: string, roleKey: string): RequestUser => ({
  userId: `user_admin_${roleKey}`,
  tenantId: tid,
  roleId: `role_admin_${roleKey}`,
});
const sales = (tid: string, roleKey: string, n: 1 | 2): RequestUser => ({
  userId: `user_sales${n}_${roleKey}`,
  tenantId: tid,
  roleId: `role_sales_${roleKey}`,
});
const TODAY = '2026-08-19';

describe('PaymentsService (integration)', () => {
  let prisma: PrismaService;
  let service: PaymentsService;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    // Real, not a stub: notify() writes a row and swallows its own failures,
    // so a service under test behaves exactly as it does in the app.
    const notifications = new NotificationsService(prisma);
    service = new PaymentsService(prisma, notifications);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('returns the seeded Acme payment with derived pending + status', async () => {
    const res = await service.list(
      admin('tenant_acme', 'acme'),
      { limit: 20 },
      TODAY,
    );

    expect(res.items).toHaveLength(1);
    const p = res.items[0];
    expect(p.refNo).toBe('PAY-ACME-001');
    expect(p.customerName).toBe('Acme Corp Customer One');
    expect(p.salespersonName).toBe('Acme Corp Sales One');
    expect(p.amount).toBe(100000);
    expect(p.received).toBe(60000);
    expect(p.pending).toBe(40000);
    expect(p.status).toBe('PartiallyPaid');
    expect(p.followups).toHaveLength(1);
  });

  it('isolates tenants — Globex admin never sees Acme payments (RLS)', async () => {
    const res = await service.list(
      admin('tenant_globex', 'globex'),
      { limit: 20 },
      TODAY,
    );
    expect(res.items.every((p) => p.refNo !== 'PAY-ACME-001')).toBe(true);
    expect(res.items[0]?.refNo).toBe('PAY-GLOBEX-001');
  });

  it('scopes a salesperson to their own payments only', async () => {
    const owner = await service.list(
      sales('tenant_acme', 'acme', 1),
      { limit: 20 },
      TODAY,
    );
    expect(owner.items).toHaveLength(1);
    const other = await service.list(
      sales('tenant_acme', 'acme', 2),
      { limit: 20 },
      TODAY,
    );
    expect(other.items).toHaveLength(0);
  });

  it('creates a manual payment with no linked customer', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      amount: 5000,
      customerName: 'Walk-in Buyer',
    });
    expect(created.customerId).toBeNull();
    expect(created.customerName).toBe('Walk-in Buyer');
    expect(created.pending).toBe(5000);
    expect(created.status).toBe('Pending');
  });

  it('derives Overdue for an unpaid, past-due payment', async () => {
    await service.create(admin('tenant_acme', 'acme'), {
      amount: 1000,
      refNo: 'PAY-OVERDUE',
      dueDate: '2026-01-01',
    });
    const res = await service.list(
      admin('tenant_acme', 'acme'),
      { limit: 20 },
      TODAY,
    );
    const p = res.items.find((x) => x.refNo === 'PAY-OVERDUE')!;
    expect(p.status).toBe('Overdue');
    // Past its due date, by the number that now says so. This used to assert
    // `agingDays`, which counted from the due date and so meant the same
    // thing; it is the age of the INVOICE now, and this payment has no
    // invoice date to be an age from — a manual entry against a walk-in
    // buyer need not have one.
    expect(p.overdueDays).toBeGreaterThan(0);
    expect(p.agingDays).toBeNull();
  });

  it('recomputes pending + status when a receipt is recorded', async () => {
    const list = await service.list(
      admin('tenant_acme', 'acme'),
      { limit: 20 },
      TODAY,
    );
    const id = list.items.find((p) => p.refNo === 'PAY-ACME-001')!.id;

    const updated = await service.update(admin('tenant_acme', 'acme'), id, {
      received: 100000,
    });
    expect(updated.pending).toBe(0);
    expect(updated.status).toBe('Paid');
  });

  it('forces a salesperson to own the payments they create', async () => {
    const created = await service.create(sales('tenant_acme', 'acme', 1), {
      amount: 200,
      salespersonId: 'user_sales2_acme',
    });
    expect(created.salespersonId).toBe('user_sales1_acme');
  });

  it('forbids a salesperson from editing another salesperson payment', async () => {
    const list = await service.list(
      admin('tenant_acme', 'acme'),
      { limit: 20 },
      TODAY,
    );
    const id = list.items.find((p) => p.refNo === 'PAY-ACME-001')!.id;
    await expect(
      service.update(sales('tenant_acme', 'acme', 2), id, { delayReason: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('who owns a receivable', () => {
    it('scopes a salesperson to invoices on their accounts, not just ones stamped with their id', async () => {
      // An invoice exported from an accounting system carries no sales owner —
      // the Promech import arrived with all 141 of them blank. Scoping on the
      // column alone meant a salesperson opened the receivables page and saw
      // nothing at all.
      const unstamped = await service.create(admin('tenant_acme', 'acme'), {
        amount: 9000,
        refNo: 'PAY-NO-OWNER',
        customerId: 'cust_1_acme',
      });
      expect(unstamped.salespersonId).toBe('user_sales1_acme');
      expect(unstamped.salespersonName).toBe('Acme Corp Sales One');

      const theirs = await service.list(
        sales('tenant_acme', 'acme', 1),
        { limit: 50 },
        TODAY,
      );
      expect(theirs.items.some((p) => p.refNo === 'PAY-NO-OWNER')).toBe(true);
    });

    it('still lets the other salesperson see nothing of it', async () => {
      const other = await service.list(
        sales('tenant_acme', 'acme', 2),
        { limit: 50 },
        TODAY,
      );
      expect(other.items.every((p) => p.refNo !== 'PAY-NO-OWNER')).toBe(true);
    });

    it('lets the account owner edit an invoice that names no owner of its own', async () => {
      const list = await service.list(
        admin('tenant_acme', 'acme'),
        { limit: 50 },
        TODAY,
      );
      const id = list.items.find((p) => p.refNo === 'PAY-NO-OWNER')!.id;
      const edited = await service.update(sales('tenant_acme', 'acme', 1), id, {
        delayReason: 'Cheque promised Friday',
      });
      expect(edited.delayReason).toBe('Cheque promised Friday');
      await expect(
        service.update(sales('tenant_acme', 'acme', 2), id, {
          delayReason: 'x',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('an explicit owner on the invoice still wins over the account', async () => {
      const stamped = await service.create(admin('tenant_acme', 'acme'), {
        amount: 100,
        refNo: 'PAY-OWNER-WINS',
        customerId: 'cust_1_acme',
        salespersonId: 'user_sales2_acme',
      });
      expect(stamped.salespersonId).toBe('user_sales2_acme');
      const owner = await service.list(
        sales('tenant_acme', 'acme', 2),
        { limit: 50 },
        TODAY,
      );
      expect(owner.items.some((p) => p.refNo === 'PAY-OWNER-WINS')).toBe(true);
      const accountOwner = await service.list(
        sales('tenant_acme', 'acme', 1),
        { limit: 50 },
        TODAY,
      );
      expect(
        accountOwner.items.every((p) => p.refNo !== 'PAY-OWNER-WINS'),
      ).toBe(true);
    });
  });

  describe('the reminder chase', () => {
    it('stamps a letter with the moment it was marked sent', async () => {
      const created = await service.create(admin('tenant_acme', 'acme'), {
        amount: 500,
        refNo: 'PAY-CHASE-1',
        salespersonId: 'user_sales1_acme',
      });
      expect(created.mail1).toBe(false);
      expect(created.mail1At).toBeNull();

      const before = Date.now();
      const sent = await service.update(
        admin('tenant_acme', 'acme'),
        created.id,
        {
          mail1: true,
        },
      );
      expect(sent.mail1).toBe(true);
      expect(sent.mail1At).not.toBeNull();
      expect(new Date(sent.mail1At!).getTime()).toBeGreaterThanOrEqual(before);
      // The letters that have not gone stay empty.
      expect(sent.mail2At).toBeNull();
    });

    it('does not move the date when a patch repeats a letter already sent', async () => {
      const created = await service.create(admin('tenant_acme', 'acme'), {
        amount: 500,
        refNo: 'PAY-CHASE-2',
      });
      const first = await service.update(
        admin('tenant_acme', 'acme'),
        created.id,
        {
          mail1: true,
        },
      );
      const again = await service.update(
        admin('tenant_acme', 'acme'),
        created.id,
        {
          mail1: true,
        },
      );
      // Re-sending the same flag is a no-op, not a second letter: the UI
      // patches the whole reminder state on every open.
      expect(again.mail1At).toBe(first.mail1At);
    });

    it('clears the date when a letter is taken back', async () => {
      const created = await service.create(admin('tenant_acme', 'acme'), {
        amount: 500,
        refNo: 'PAY-CHASE-3',
      });
      await service.update(admin('tenant_acme', 'acme'), created.id, {
        mail1: true,
      });
      const undone = await service.update(
        admin('tenant_acme', 'acme'),
        created.id,
        {
          mail1: false,
        },
      );
      expect(undone.mail1).toBe(false);
      // A date on a letter that has not gone is worse than no date at all.
      expect(undone.mail1At).toBeNull();
    });

    it('tells the collector in words which letter went out', async () => {
      const created = await service.create(admin('tenant_acme', 'acme'), {
        amount: 500,
        refNo: 'PAY-CHASE-4',
        invoiceNo: 'INV-CHASE-4',
        salespersonId: 'user_sales1_acme',
      });
      await service.update(admin('tenant_acme', 'acme'), created.id, {
        mail1: true,
      });
      await service.update(admin('tenant_acme', 'acme'), created.id, {
        mail2: true,
      });

      const notes = await prisma
        .forTenant('tenant_acme')
        .notification.findMany({
          where: { entityId: created.id, type: 'PaymentReminder' },
          orderBy: { at: 'asc' },
        });
      expect(notes.map((n) => n.title)).toEqual([
        '1st reminder sent for INV-CHASE-4',
        '2nd reminder sent for INV-CHASE-4',
      ]);
    });

    it('stamps letters that arrive already sent on a new payment', async () => {
      const created = await service.create(admin('tenant_acme', 'acme'), {
        amount: 500,
        refNo: 'PAY-CHASE-5',
        mail1: true,
        mail2: false,
      });
      expect(created.mail1At).not.toBeNull();
      expect(created.mail2At).toBeNull();
    });

    /**
     * The sequence, enforced where it counts.
     *
     * `ReminderMenu` in the console offers exactly one actionable letter, so
     * none of this was reachable through the UI — and none of it was checked
     * by the API either. A direct PATCH could mark the third letter sent on an
     * invoice that had never had a first, stamp its date, and notify the
     * collector about a letter nobody wrote.
     */
    describe('is a sequence, not four switches', () => {
      const chased = () =>
        service.create(admin('tenant_acme', 'acme'), {
          amount: 1000,
          refNo: `PAY-SEQ-${Math.random().toString(36).slice(2, 8)}`,
        });

      it('refuses the second letter before the first', async () => {
        const p = await chased();
        await expect(
          service.update(admin('tenant_acme', 'acme'), p.id, { mail2: true }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('refuses the third letter after only the first', async () => {
        const p = await chased();
        await service.update(admin('tenant_acme', 'acme'), p.id, {
          mail1: true,
        });
        await expect(
          service.update(admin('tenant_acme', 'acme'), p.id, { mail3: true }),
        ).rejects.toThrow(/in order/i);
      });

      it('accepts the letters one at a time, in order, all four', async () => {
        const p = await chased();
        let row = p;
        for (const stage of ['mail1', 'mail2', 'mail3', 'mail4'] as const) {
          row = await service.update(admin('tenant_acme', 'acme'), row.id, {
            [stage]: true,
          });
        }
        expect([row.mail1, row.mail2, row.mail3, row.mail4]).toEqual([
          true,
          true,
          true,
          true,
        ]);
      });

      it('refuses two letters in one patch — a letter sent is an event', async () => {
        const p = await chased();
        await expect(
          service.update(admin('tenant_acme', 'acme'), p.id, {
            mail1: true,
            mail2: true,
          }),
        ).rejects.toThrow(/one reminder can be marked at a time/i);
      });

      it('takes back the most recent letter, but never one underneath it', async () => {
        const p = await chased();
        await service.update(admin('tenant_acme', 'acme'), p.id, {
          mail1: true,
        });
        await service.update(admin('tenant_acme', 'acme'), p.id, {
          mail2: true,
        });

        // The one underneath would leave the chase with a hole in it.
        await expect(
          service.update(admin('tenant_acme', 'acme'), p.id, { mail1: false }),
        ).rejects.toBeInstanceOf(BadRequestException);

        const undone = await service.update(
          admin('tenant_acme', 'acme'),
          p.id,
          { mail2: false },
        );
        expect(undone.mail2).toBe(false);
        expect(undone.mail2At).toBeNull();
        expect(undone.mail1).toBe(true);
      });

      it('refuses a new payment whose opening chase has a gap in it', async () => {
        await expect(
          service.create(admin('tenant_acme', 'acme'), {
            amount: 100,
            refNo: 'PAY-SEQ-GAP',
            mail1: false,
            mail3: true,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('still lets an import arrive with several letters already behind it', async () => {
        const imported = await service.create(admin('tenant_acme', 'acme'), {
          amount: 100,
          refNo: 'PAY-SEQ-IMPORT',
          mail1: true,
          mail2: true,
        });
        expect(imported.mail2).toBe(true);
        expect(imported.mail3).toBe(false);
      });
    });
  });

  /**
   * Ownership, which `loadOwned` proves at the START of a patch and said
   * nothing about at the end of one.
   *
   * A salesperson owning a receivable was enough to push it onto a colleague,
   * or onto an account that is not theirs — either of which takes an overdue
   * invoice out of their own aging report. The console offers neither; a
   * direct PATCH offered both.
   */
  describe('a salesperson cannot give a receivable away', () => {
    const mine = () =>
      service.create(sales('tenant_acme', 'acme', 1), {
        amount: 2000,
        refNo: `PAY-OWN-${Math.random().toString(36).slice(2, 8)}`,
        customerId: 'cust_1_acme',
      });

    it('refuses to hand it to another salesperson', async () => {
      const p = await mine();
      await expect(
        service.update(sales('tenant_acme', 'acme', 1), p.id, {
          salespersonId: 'user_sales2_acme',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses to strip the owner off it', async () => {
      const p = await mine();
      await expect(
        service.update(sales('tenant_acme', 'acme', 1), p.id, {
          salespersonId: null,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses to move it onto an account it cannot reach', async () => {
      // An account belonging to the OTHER rep. Moving a receivable there is
      // how an overdue invoice leaves one book and lands on another's.
      const theirs = await prisma.forTenant('tenant_acme').customer.create({
        data: {
          tenantId: 'tenant_acme',
          name: 'Acme Corp Customer Two',
          salespersonId: 'user_sales2_acme',
        },
      });
      const p = await mine();
      await expect(
        service.update(sales('tenant_acme', 'acme', 1), p.id, {
          customerId: theirs.id,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses to detach it from its account altogether', async () => {
      const p = await mine();
      await expect(
        service.update(sales('tenant_acme', 'acme', 1), p.id, {
          customerId: null,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('still lets them keep the owner they already have', async () => {
      const p = await mine();
      const same = await service.update(sales('tenant_acme', 'acme', 1), p.id, {
        salespersonId: 'user_sales1_acme',
        delayReason: 'Awaiting PO copy',
      });
      expect(same.delayReason).toBe('Awaiting PO copy');
    });

    it('lets an administrator do the reassignment', async () => {
      const p = await mine();
      const moved = await service.update(admin('tenant_acme', 'acme'), p.id, {
        salespersonId: 'user_sales2_acme',
      });
      expect(moved.salespersonId).toBe('user_sales2_acme');
    });
  });

  it('soft-deletes a payment so it drops out of the list', async () => {
    const created = await service.create(admin('tenant_acme', 'acme'), {
      amount: 10,
      refNo: 'PAY-DOOM',
    });
    await service.remove(admin('tenant_acme', 'acme'), created.id);
    const list = await service.list(
      admin('tenant_acme', 'acme'),
      { limit: 20 },
      TODAY,
    );
    expect(list.items.some((p) => p.id === created.id)).toBe(false);
    await expect(
      service.update(admin('tenant_acme', 'acme'), created.id, { amount: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
