import {
  allowedNextStatuses,
  canTransition,
  computeTotal,
  isTerminalOrderStatus,
  lineTotal,
  ORDER_STATUS_FLOW,
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

  describe('fulfilment state machine', () => {
    it('allows each forward step along the chain, plus cancel', () => {
      for (let i = 0; i < ORDER_STATUS_FLOW.length - 1; i++) {
        const from = ORDER_STATUS_FLOW[i];
        const to = ORDER_STATUS_FLOW[i + 1];
        expect(canTransition(from, to)).toBe(true);
        expect(canTransition(from, 'Cancelled')).toBe(true);
      }
    });

    it('rejects skipping a stage', () => {
      expect(canTransition('Created', 'DeliveryPartnerAssigned')).toBe(false);
      expect(canTransition('Acknowledged', 'DeliveredToCustomer')).toBe(false);
      expect(canTransition('Created', 'CustomerReceiptConfirmed')).toBe(false);
    });

    it('rejects moving backwards', () => {
      expect(canTransition('Acknowledged', 'Created')).toBe(false);
      expect(canTransition('DeliveredToCustomer', 'Acknowledged')).toBe(false);
    });

    it('treats a no-op (same status) as not a transition', () => {
      expect(canTransition('Acknowledged', 'Acknowledged')).toBe(false);
    });

    it('has no moves out of a terminal state', () => {
      expect(isTerminalOrderStatus('Cancelled')).toBe(true);
      expect(isTerminalOrderStatus('CustomerReceiptConfirmed')).toBe(true);
      expect(allowedNextStatuses('Cancelled')).toEqual([]);
      expect(allowedNextStatuses('CustomerReceiptConfirmed')).toEqual([]);
      expect(canTransition('Cancelled', 'Created')).toBe(false);
      expect(canTransition('CustomerReceiptConfirmed', 'Cancelled')).toBe(
        false,
      );
    });

    it('final delivered stage can still be cancelled, but not advanced', () => {
      expect(
        canTransition('DeliveredToCustomer', 'CustomerReceiptConfirmed'),
      ).toBe(true);
      expect(canTransition('DeliveredToCustomer', 'Cancelled')).toBe(true);
      // CustomerReceiptConfirmed is the terminal success — nothing follows it.
      expect(allowedNextStatuses('DeliveredToCustomer')).toEqual([
        'CustomerReceiptConfirmed',
        'Cancelled',
      ]);
    });
  });
});
