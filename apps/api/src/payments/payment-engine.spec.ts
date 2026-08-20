import { agingDays, deriveStatus, pending } from './payment-engine';

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

  describe('agingDays', () => {
    it('counts days past a due date', () => {
      expect(agingDays('2026-08-09', '2026-08-19')).toBe(10);
    });
    it('is 0 before the due date', () => {
      expect(agingDays('2026-12-31', '2026-08-19')).toBe(0);
    });
    it('is null with no due date', () => {
      expect(agingDays(null, '2026-08-19')).toBeNull();
    });
  });
});
