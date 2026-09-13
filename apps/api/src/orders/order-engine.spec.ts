import {
  canTransition,
  computeTotal,
  lineTotal,
  nextStatus,
  type EngineItem,
} from './order-engine';

/**
 * Pure order arithmetic — no DB. Money is Decimal(14,2) in the store, so every
 * result is rounded to 2 places to match what Postgres persists.
 */
describe('order-engine', () => {
  describe('lineTotal', () => {
    it('multiplies qty by price', () => {
      expect(lineTotal({ qty: 1000, price: 100 })).toBe(100_000);
    });

    it('rounds to 2 decimal places (banker-free, half-up)', () => {
      expect(lineTotal({ qty: 3, price: 0.1 })).toBe(0.3);
      expect(lineTotal({ qty: 10, price: 99.99 })).toBe(999.9);
    });

    it('treats a zero-qty line as zero', () => {
      expect(lineTotal({ qty: 0, price: 500 })).toBe(0);
    });
  });

  describe('computeTotal', () => {
    it('sums the line totals', () => {
      const items: EngineItem[] = [
        { qty: 1000, price: 100 },
        { qty: 2, price: 250 },
      ];
      expect(computeTotal(items)).toBe(100_500);
    });

    it('is zero for no items', () => {
      expect(computeTotal([])).toBe(0);
    });

    it('rounds the aggregate, not just the parts', () => {
      const items: EngineItem[] = [
        { qty: 1, price: 0.1 },
        { qty: 1, price: 0.2 },
      ];
      expect(computeTotal(items)).toBe(0.3);
    });
  });

  describe('canTransition', () => {
    it('allows exactly one rung forward', () => {
      expect(canTransition('Created', 'Acknowledged')).toBe(true);
      expect(
        canTransition('DeliveredFromWarehouse', 'DeliveredToCustomer'),
      ).toBe(true);
    });

    it('refuses a skip — a delivery cannot precede a dispatch', () => {
      expect(canTransition('Created', 'CustomerReceiptConfirmed')).toBe(false);
      expect(canTransition('Acknowledged', 'DeliveredToCustomer')).toBe(false);
    });

    it('allows one rung back as a correction, but no further', () => {
      expect(
        canTransition('DeliveredToCustomer', 'DeliveredFromWarehouse'),
      ).toBe(true);
      expect(canTransition('CustomerReceiptConfirmed', 'Acknowledged')).toBe(
        false,
      );
    });

    it('cancels from any live rung', () => {
      expect(canTransition('Created', 'Cancelled')).toBe(true);
      expect(canTransition('DeliveredToCustomer', 'Cancelled')).toBe(true);
    });

    it('never brings a cancelled order back to life', () => {
      expect(canTransition('Cancelled', 'Created')).toBe(false);
      expect(canTransition('Cancelled', 'Acknowledged')).toBe(false);
    });

    it('treats a no-op as nothing to do', () => {
      expect(canTransition('Acknowledged', 'Acknowledged')).toBe(false);
    });
  });

  describe('nextStatus', () => {
    it('names the rung above', () => {
      expect(nextStatus('Created')).toBe('Acknowledged');
    });

    it('is null at the top of the ladder and off it', () => {
      expect(nextStatus('CustomerReceiptConfirmed')).toBeNull();
      expect(nextStatus('Cancelled')).toBeNull();
    });
  });
});
