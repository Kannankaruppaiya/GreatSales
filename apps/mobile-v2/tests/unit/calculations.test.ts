import { describe, it, expect } from 'vitest';
import {
  calculateOrderTotals,
  calculateAgingDays,
  getFollowUpCategory,
  calculatePriorityItems,
  getTodayIso,
} from '../../src/domain/calculations';
import type { FollowUp, Payment } from '../../src/domain/types';

describe('Domain Calculations', () => {
  it('calculates order totals correctly with 18% GST', () => {
    const items = [
      { qty: 2, price: 1000 },
      { qty: 1, price: 3000 },
    ];
    const { subtotal, tax, total } = calculateOrderTotals(items);
    expect(subtotal).toBe(5000);
    expect(tax).toBe(900);
    expect(total).toBe(5900);
  });

  it('calculates aging days correctly', () => {
    const today = getTodayIso();
    expect(calculateAgingDays(today)).toBe(0);

    const pastDate = '2026-01-01';
    expect(calculateAgingDays(pastDate)).toBeGreaterThan(0);
  });

  /*
   * The dashboard-metrics test that stood here is gone with the function.
   * calculateDashboardMetrics summed committed and achieved value over arrays
   * the client holds, against a monthlyTarget hardcoded in its signature; GET
   * /dashboard returns all of it, computed over the whole tenant with the real
   * SalesTarget rows. The test passed because the fixtures handed it whole
   * arrays - over a cursor-paginated list it would have totalled 20 rows of
   * however many the tenant has.
   */

  it('ranks an overdue red-zone payment above an overdue follow-up, and drops settled and done rows', () => {
    // Shapes are PaymentRow and FollowUpRow. The previous fixtures carried
    // invoiceCode, paymentZone: 'Red', customerId on a follow-up and
    // priority: 'High' - none of which the API sends. The test passed on them
    // anyway, which is how the ranking came to branch on a field that does not
    // exist.
    const payments: Payment[] = [
      {
        id: 'pay_red',
        refNo: 'PAY-0501',
        customerId: 'cust_05',
        customerName: 'Southern Auto Works & Castings',
        salespersonId: 'usr_megala',
        salespersonName: 'Megala',
        invoiceNo: 'INV-2026-0501',
        invoiceDate: '2026-07-12',
        amount: 1_120_000,
        received: 0,
        pending: 1_120_000,
        dueDate: '2026-07-12',
        agingDays: 63,
        payZone: 'RedZone',
        delayReason: null,
        nextFollowUp: null,
        mail1: true, mail2: true, mail3: true, mail4: false,
        mail1At: null, mail2At: null, mail3At: null, mail4At: null,
        status: 'Overdue',
        followups: [],
        createdAt: '2026-07-12',
        updatedAt: '2026-09-10',
      },
      {
        id: 'pay_settled',
        refNo: 'PAY-0100',
        customerId: 'cust_01',
        customerName: 'ABC Industrial',
        salespersonId: 'usr_megala',
        salespersonName: 'Megala',
        invoiceNo: 'INV-2026-0100',
        invoiceDate: '2026-08-01',
        amount: 500_000,
        received: 500_000,
        pending: 0,
        dueDate: '2026-08-01',
        agingDays: 40,
        payZone: null,
        delayReason: null,
        nextFollowUp: null,
        mail1: false, mail2: false, mail3: false, mail4: false,
        mail1At: null, mail2At: null, mail3At: null, mail4At: null,
        status: 'Paid',
        followups: [],
        createdAt: '2026-08-01',
        updatedAt: '2026-09-01',
      },
    ];

    const followUps: FollowUp[] = [
      {
        id: 'fu_overdue',
        entityType: 'Lead',
        entityId: 'lead_01',
        salespersonId: 'usr_megala',
        salespersonName: 'Megala',
        title: 'Oral Confirmation PO Close',
        subtitle: 'ABC Industrial Components',
        amount: 250_000,
        dueDate: '2000-01-01', // safely in the past whenever this runs
        done: false,
        note: null,
        createdAt: '2026-09-01',
        updatedAt: '2026-09-05',
      },
      {
        id: 'fu_done',
        entityType: 'Order',
        entityId: 'so_02',
        salespersonId: 'usr_megala',
        salespersonName: 'Megala',
        title: 'Completed Delivery',
        subtitle: null,
        amount: null,
        dueDate: '2000-01-01',
        done: true,
        note: null,
        createdAt: '2026-09-01',
        updatedAt: '2026-09-02',
      },
    ];

    const ranked = calculatePriorityItems(payments, followUps);

    // A settled invoice and a completed follow-up are not work.
    expect(ranked.map((r) => r.id)).toEqual(['pay_red', 'fu_overdue']);

    expect(ranked[0].type).toBe('payment');
    expect(ranked[0].isRedZone).toBe(true);
    expect(ranked[0].title).toBe('Invoice INV-2026-0501');

    expect(ranked[1].type).toBe('followup');
    // The follow-up falls back to its subtitle for a customer name: neither
    // FollowUpRow nor DashboardFollowUp carries one.
    expect(ranked[1].customerName).toBe('ABC Industrial Components');
    expect(ranked[1].daysOverdue).toBeGreaterThan(0);
  });

  it('keeps a long-overdue follow-up below a red-zone payment', () => {
    // The regression this pins: the follow-up term was `daysOverdue * 10`
    // with no ceiling, so a row left open for a few weeks scored above any
    // invoice - a forgotten courtesy call ranked over a 1.1 crore debt. Each
    // band's within-band term is clamped now, so the bands hold at any age.
    const ancient: FollowUp = {
      id: 'fu_ancient',
      entityType: 'Lead',
      entityId: 'lead_99',
      salespersonId: 'usr_megala',
      salespersonName: 'Megala',
      title: 'Forgotten call',
      subtitle: null,
      amount: null,
      dueDate: '2000-01-01',
      done: false,
      note: null,
      createdAt: '2000-01-01',
      updatedAt: '2000-01-01',
    };
    const smallRedInvoice: Payment = {
      id: 'pay_small_red',
      refNo: 'PAY-9', customerId: 'c9', customerName: 'Tiny Co',
      salespersonId: 'usr_megala', salespersonName: 'Megala',
      invoiceNo: 'INV-9', invoiceDate: '2026-09-01',
      amount: 1000, received: 0, pending: 1000,
      dueDate: '2026-09-01', agingDays: 1, payZone: 'RedZone',
      delayReason: null, nextFollowUp: null,
      mail1: false, mail2: false, mail3: false, mail4: false,
      mail1At: null, mail2At: null, mail3At: null, mail4At: null,
      status: 'Overdue', followups: [],
      createdAt: '2026-09-01', updatedAt: '2026-09-01',
    };

    const ranked = calculatePriorityItems([smallRedInvoice], [ancient]);

    expect(ranked.map((r) => r.id)).toEqual(['pay_small_red', 'fu_ancient']);
    expect(ranked[0].urgencyScore).toBeGreaterThanOrEqual(1000);
    expect(ranked[1].urgencyScore).toBeLessThan(1000);
  });
});
