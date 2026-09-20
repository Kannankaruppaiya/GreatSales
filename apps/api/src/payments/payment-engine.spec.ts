import {
  deriveStatus,
  dueDateFor,
  invoiceAgeDays,
  overdueDays,
  pending,
} from './payment-engine';

/**
 * Pure payment arithmetic — no DB. Determines what a payment "owes" and its
 * lifecycle status from amount/received/dueDate, evaluated against a given day.
 */
describe('payment-engine', () => {
  describe('pending', () => {
    it('is amount minus received', () => {
      expect(pending(100_000, 60_000)).toBe(40_000);
    });
    it('never goes negative (overpayment clamps to 0)', () => {
      expect(pending(100, 150)).toBe(0);
    });
  });

  describe('deriveStatus', () => {
    const future = '2026-12-31';
    const past = '2026-01-01';
    const today = '2026-08-19';

    it('is Paid once received covers the amount', () => {
      expect(deriveStatus(100, 100, future, today)).toBe('Paid');
    });
    it('Paid wins even past the due date', () => {
      expect(deriveStatus(100, 100, past, today)).toBe('Paid');
    });
    it('is Overdue when unpaid past the due date', () => {
      expect(deriveStatus(100, 40, past, today)).toBe('Overdue');
    });
    it('is PartiallyPaid when part-received and not overdue', () => {
      expect(deriveStatus(100, 40, future, today)).toBe('PartiallyPaid');
    });
    it('is Pending when nothing received and not overdue', () => {
      expect(deriveStatus(100, 0, future, today)).toBe('Pending');
    });
    it('is Pending when nothing received and no due date', () => {
      expect(deriveStatus(100, 0, null, today)).toBe('Pending');
    });
  });

  /**
   * The two numbers this used to conflate.
   *
   * There was one function, called `agingDays`, that counted from the DUE
   * date — so the Aging column on an invoice dated 22 Oct 2024 read 664 on a
   * day 694 days later, quietly short by the 30 days of credit. Aging is how
   * old the invoice is; being overdue is a different question with a different
   * answer, and both are now asked by name.
   */
  describe('invoiceAgeDays', () => {
    it('counts days since the invoice was raised', () => {
      expect(invoiceAgeDays('2026-08-09', '2026-08-19')).toBe(10);
    });
    it('matches the calendar, with no credit period subtracted', () => {
      // The row from the screenshot that started this: 22 Oct 2024, read on
      // 16 Sep 2026. It used to say 664.
      expect(invoiceAgeDays('2024-10-22', '2026-09-16')).toBe(694);
    });
    it('is 0 for an invoice dated in the future, never negative', () => {
      expect(invoiceAgeDays('2026-12-31', '2026-08-19')).toBe(0);
    });
    it('is null with no invoice date', () => {
      expect(invoiceAgeDays(null, '2026-08-19')).toBeNull();
    });
  });

  describe('overdueDays', () => {
    it('counts days past the due date', () => {
      expect(overdueDays('2026-08-09', '2026-08-19')).toBe(10);
    });
    it('is 0 while still within terms', () => {
      expect(overdueDays('2026-12-31', '2026-08-19')).toBe(0);
    });
    it('is null with no due date', () => {
      expect(overdueDays(null, '2026-08-19')).toBeNull();
    });
  });

  describe('dueDateFor', () => {
    it('adds the credit the customer was actually granted', () => {
      expect(dueDateFor('2026-08-01', 'Credit45')).toBe('2026-09-15');
      expect(dueDateFor('2026-08-01', 'Credit15')).toBe('2026-08-16');
    });
    it('is the invoice date itself when nothing is on credit', () => {
      // Cash on delivery was being given a month it never had.
      expect(dueDateFor('2026-08-01', 'CashOnDelivery')).toBe('2026-08-01');
      expect(dueDateFor('2026-08-01', 'Immediate')).toBe('2026-08-01');
    });
    it('falls back to 30 days when no terms are recorded', () => {
      // Which is what every row used to get, so a customer whose terms nobody
      // has filled in behaves exactly as it did before.
      expect(dueDateFor('2026-08-01', null)).toBe('2026-08-31');
    });
    it('lets a due date somebody actually typed win', () => {
      // Add Payment has the field. A one-off arrangement is a fact about that
      // invoice, not something a rule gets to overwrite.
      expect(dueDateFor('2026-08-01', 'Credit15', '2026-10-10')).toBe(
        '2026-10-10',
      );
    });
    it('is null with no invoice date and nothing stored', () => {
      expect(dueDateFor(null, 'Credit30')).toBeNull();
    });
  });
});
