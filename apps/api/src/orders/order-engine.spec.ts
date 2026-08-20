import { computeTotal, lineTotal, type EngineItem } from './order-engine';

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
});
