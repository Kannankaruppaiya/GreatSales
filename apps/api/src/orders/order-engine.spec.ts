import {
  canTransition,
  computeOrderTotals,
  computeSubtotal,
  lineTotal,
  nextStatus,
  validateTaxSpec,
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

  describe('computeSubtotal', () => {
    it('sums the line totals', () => {
      const items: EngineItem[] = [
        { qty: 1000, price: 100 },
        { qty: 2, price: 250 },
      ];
      expect(computeSubtotal(items)).toBe(100_500);
    });

    it('is zero for no items', () => {
      expect(computeSubtotal([])).toBe(0);
    });

    it('rounds each line, then sums — no float residue in the aggregate', () => {
      const items: EngineItem[] = [
        { qty: 1, price: 0.1 },
        { qty: 1, price: 0.2 },
      ];
      expect(computeSubtotal(items)).toBe(0.3);
    });

    it('stays exact over many fractional lines', () => {
      // The float sum of a hundred 0.1s is 9.999999999999998, which is not a
      // value Decimal(14,2) can hold and not what the customer is charged.
      const items: EngineItem[] = Array.from({ length: 100 }, () => ({
        qty: 1,
        price: 0.1,
      }));
      expect(computeSubtotal(items)).toBe(10);
    });
  });

  /**
   * The three GST modes. The dataset this product was built from charges 18% on
   * every order, but 18% is that dataset's rate rather than a rule — hence a
   * mode and a rate column, and hence these tests using several rates.
   */
  describe('computeOrderTotals', () => {
    const items: EngineItem[] = [{ qty: 10, price: 1000 }];

    it('adds no tax at all in None mode', () => {
      const t = computeOrderTotals(items, { mode: 'None' });
      expect(t).toMatchObject({
        subtotal: 10_000,
        taxMode: 'None',
        taxRate: null,
        taxAmount: 0,
        total: 10_000,
      });
    });

    it('ignores a rate and an amount left over from another mode', () => {
      const t = computeOrderTotals(items, {
        mode: 'None',
        rate: 18,
        amount: 1500,
      });
      expect(t.taxAmount).toBe(0);
      expect(t.total).toBe(10_000);
    });

    it('computes the tax from the percentage', () => {
      const t = computeOrderTotals(items, { mode: 'Percentage', rate: 18 });
      expect(t).toMatchObject({
        subtotal: 10_000,
        taxRate: 18,
        taxAmount: 1800,
        total: 11_800,
      });
    });

    it('is not fixed at 18% — the rate is whatever the order carries', () => {
      expect(
        computeOrderTotals(items, { mode: 'Percentage', rate: 5 }).total,
      ).toBe(10_500);
      expect(
        computeOrderTotals(items, { mode: 'Percentage', rate: 12.5 }).total,
      ).toBe(11_250);
      expect(
        computeOrderTotals(items, { mode: 'Percentage', rate: 0 }).total,
      ).toBe(10_000);
    });

    it('rounds a percentage that lands between paise, to the paise', () => {
      const t = computeOrderTotals([{ qty: 1, price: 99.99 }], {
        mode: 'Percentage',
        rate: 18,
      });
      expect(t.taxAmount).toBe(18);
      expect(t.total).toBe(117.99);
    });

    it('takes the entered figure verbatim in Amount mode', () => {
      const t = computeOrderTotals(items, { mode: 'Amount', amount: 1500 });
      expect(t).toMatchObject({
        subtotal: 10_000,
        taxRate: null,
        taxAmount: 1500,
        total: 11_500,
      });
    });

    it('treats the line price as GST-exclusive in every mode', () => {
      // subtotal is the line sum, untouched; the tax is only ever added on top.
      for (const tax of [
        { mode: 'None' as const },
        { mode: 'Percentage' as const, rate: 18 },
        { mode: 'Amount' as const, amount: 1 },
      ]) {
        expect(computeOrderTotals(items, tax).subtotal).toBe(10_000);
      }
    });
  });

  describe('validateTaxSpec', () => {
    it('accepts the modes that carry what they need', () => {
      expect(validateTaxSpec({ mode: 'None' })).toBeNull();
      expect(validateTaxSpec({ mode: 'Percentage', rate: 18 })).toBeNull();
      expect(validateTaxSpec({ mode: 'Amount', amount: 0 })).toBeNull();
    });

    it('refuses a percentage mode with no percentage', () => {
      expect(validateTaxSpec({ mode: 'Percentage' })).toMatch(/required/i);
      expect(validateTaxSpec({ mode: 'Percentage', rate: null })).toMatch(
        /required/i,
      );
    });

    it('refuses a percentage outside 0–100', () => {
      expect(validateTaxSpec({ mode: 'Percentage', rate: -1 })).toMatch(
        /between 0 and 100/,
      );
      expect(validateTaxSpec({ mode: 'Percentage', rate: 101 })).toMatch(
        /between 0 and 100/,
      );
    });

    it('refuses a percentage finer than the column can hold', () => {
      expect(validateTaxSpec({ mode: 'Percentage', rate: 18.005 })).toMatch(
        /two decimal places/,
      );
    });

    it('refuses an amount mode with no amount, or a negative one', () => {
      expect(validateTaxSpec({ mode: 'Amount' })).toMatch(/required/i);
      expect(validateTaxSpec({ mode: 'Amount', amount: -1 })).toMatch(
        /negative/,
      );
    });

    it('refuses an amount finer than a paisa', () => {
      expect(validateTaxSpec({ mode: 'Amount', amount: 1.005 })).toMatch(
        /two paise/,
      );
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
